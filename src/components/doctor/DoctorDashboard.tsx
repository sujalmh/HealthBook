import React, { useState, useEffect, useMemo } from 'react';
import { Stethoscope, Users, Shield, Calendar, Activity, Pill, AlertTriangle, Clock, ChevronRight, Search, Eye } from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import type { DoctorPatientLink } from '@/types/carecircle';

interface DoctorDashboardProps {
  doctorId: string;
  doctorProfile: { userId: string; name: string; email?: string; role: string };
  onSelectPatient: (patientId: string) => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ doctorId, doctorProfile, onSelectPatient }) => {
  const [links, setLinks] = useState<DoctorPatientLink[]>(() => {
    try { return localVault.getPatientsForDoctor(doctorId); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    // Try vault direct then tool fallback
    let list: DoctorPatientLink[] = [];
    try {
      list = localVault.getPatientsForDoctor(doctorId);
      if (list.length === 0) {
        // try via email
        if (doctorProfile.email) list = localVault.getPatientsForDoctor(doctorProfile.email);
      }
      if (list.length === 0) {
        // hydrate links seeded in Supabase care_circle payloads (payload->>doctorId / doctorEmail)
        const { hydrateDoctorLinksFromSupabase, hydratePatientsForDoctor } = await import('@/core/vault/supabaseSync');
        const remote = await hydrateDoctorLinksFromSupabase(doctorId, doctorProfile.email, localVault);
        if (remote.length > 0) {
          list = localVault.getPatientsForDoctor(doctorId).length > 0 ? localVault.getPatientsForDoctor(doctorId) : remote;
          // fill card stats (labs/meds/alerts) — patient vaults aren't hydrated under a doctor account
          await hydratePatientsForDoctor(list.map((l) => l.patientId), localVault);
        }
      }
      if (list.length === 0) {
        // fallback via tool
        const res = await webMCPEngine.execute('list_doctor_patients', { doctorId });
        if (res.success && Array.isArray(res.data)) list = res.data as unknown as DoctorPatientLink[];
      }
    } catch {}
    // dedup by linkId
    const seen = new Set<string>();
    setLinks(list.filter((l) => l && l.linkId && !seen.has(l.linkId) && seen.add(l.linkId)));
  };

  useEffect(() => {
    load();
    const u1 = eventBus.on('doctor_linked', load);
    const u2 = eventBus.on('doctor_revoked', load);
    const u3 = eventBus.on('doctor_grant_added', load);
    return () => { u1(); u2(); u3(); };
  }, [doctorId, doctorProfile.email]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) =>
      l.patientName?.toLowerCase().includes(q) ||
      l.patientId.toLowerCase().includes(q) ||
      l.doctorName.toLowerCase().includes(q)
    );
  }, [links, search]);

  const patientStats = useMemo(() => {
    const map = new Map<string, { meds: number; labs: number; pending: number; dangers: number; due: number }>();
    for (const link of filtered) {
      const pid = link.patientId;
      try {
        const meds = localVault.getMedications(pid).length;
        const labs = localVault.getLabs(pid).length;
        const pending = localVault.getPendingProposals(pid).length;
        const dangers = localVault.getDangerReports(pid).filter((r: { triagePriority?: string }) => r.triagePriority === 'URGENT' || r.triagePriority === 'EMERGENCY').length;
        const due = localVault.getDueCards(pid).filter((c: { status?: string }) => c.status !== 'completed').length;
        map.set(pid, { meds, labs, pending, dangers, due });
      } catch {
        map.set(pid, { meds: 0, labs: 0, pending: 0, dangers: 0, due: 0 });
      }
    }
    return map;
  }, [filtered]);

  if (links.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-sm">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">My Patients</h2>
              <p className="text-body-sm text-muted">Patients who have linked you for remote review.</p>
            </div>
          </div>
        </div>
        <div className="bg-canvas-muted rounded-2xl p-8 sm:p-12 text-center border border-dashed border-canvas-border space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-canvas-card border border-canvas-border text-muted flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-heading-md font-bold text-slate-900">No patients linked yet</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto">Ask your patients to link you via <strong>Family → My Doctors</strong> or share a time-bound token via <strong>Health → For Doctor → Share</strong>. Once linked, their records appear here.</p>
          <div className="pt-2">
            <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-canvas-border text-body-sm font-semibold hover:bg-canvas-muted min-h-[44px]">Refresh</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">My Patients <span className="text-caption px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">{links.length} linked</span></h2>
            <p className="text-body-sm text-muted">Linked patients — tap to view their record (scoped to your permission).</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption px-3 py-1.5 rounded-full bg-canvas-muted text-muted font-semibold border border-canvas-border hidden sm:inline-flex">Doctor: {doctorProfile.name}</span>
          <button onClick={load} className="p-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted border border-canvas-border min-h-[44px] min-w-[44px] flex items-center justify-center" title="Refresh"><Users className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients by name or ID…" className="w-full bg-canvas-muted border border-canvas-border rounded-xl pl-10 pr-4 py-2.5 text-body-sm text-slate-900 placeholder:text-muted focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]" />
        </div>
        <span className="text-caption text-muted whitespace-nowrap">{filtered.length} patient{filtered.length!==1?'s':''} • {links.length} total linked</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((link) => {
          const pid = link.patientId;
          const stats = patientStats.get(pid) || { meds: 0, labs: 0, pending: 0, dangers: 0, due: 0 };
          const { meds, labs, pending, dangers, due } = stats;
          const isCritical = dangers > 0;
          return (
            <div key={link.linkId} onClick={() => onSelectPatient(pid)} className={`cursor-pointer rounded-2xl border p-5 space-y-4 shadow-sm hover:shadow-md transition-all ${isCritical ? 'bg-rose-50 border-rose-200' : 'bg-canvas-card border-canvas-border hover:border-emerald-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h4 className="text-base font-bold text-slate-900 truncate">{link.patientName || pid}</h4>
                  <p className="text-caption text-muted font-mono truncate">{pid}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className={`text-caption px-2 py-0.5 rounded-full font-bold border uppercase ${link.permissionLevel==='full' ? 'bg-emerald-600 text-white border-emerald-600' : link.permissionLevel==='manage' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{link.permissionLevel}</span>
                    <span className="text-caption px-2 py-0.5 rounded-full bg-canvas-muted text-muted border border-canvas-border">{link.scope}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-caption font-bold border uppercase shrink-0 ${isCritical ? 'bg-rose-500/20 text-rose-700 border-rose-200' : due>0 ? 'bg-amber-500/20 text-amber-700 border-amber-200' : 'bg-emerald-500/10 text-emerald-700 border-emerald-200'}`}>{isCritical ? 'Critical' : due>0 ? 'Due' : 'Stable'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-body-sm">
                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold flex items-center justify-center gap-1"><Pill className="w-3 h-3" /> Meds</div>
                  <div className="text-heading-md font-bold text-slate-900">{meds}</div>
                </div>
                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold flex items-center justify-center gap-1"><Activity className="w-3 h-3" /> Labs</div>
                  <div className="text-heading-md font-bold text-slate-900">{labs}</div>
                </div>
                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold">Alerts</div>
                  <div className={`text-heading-md font-bold ${dangers>0 ? 'text-rose-600' : 'text-muted'}`}>{dangers}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-caption text-muted">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Linked {new Date(link.linkedDate).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 text-emerald-700 font-bold">View <ChevronRight className="w-3.5 h-3.5" /></span>
              </div>
              {pending>0 && <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-caption text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {pending} pending proposal{pending!==1?'s':''} awaiting patient approval</div>}
            </div>
          );
        })}
      </div>

      {filtered.length===0 && links.length>0 && (
        <div className="bg-canvas-muted rounded-xl p-6 text-center border border-canvas-border">
          <p className="text-body-sm text-muted">No patients match “{search}”.</p>
          <button onClick={() => setSearch('')} className="mt-2 px-4 py-2 rounded-xl bg-white border border-canvas-border text-body-sm font-semibold min-h-[44px]">Clear search</button>
        </div>
      )}
    </div>
  );
};
