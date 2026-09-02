import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Shield, Pill, Activity, Heart, AlertTriangle, Clock, Stethoscope, Eye, FileText } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface DoctorPatientViewProps {
  patientId: string;
  doctorId: string;
  doctorProfile: { userId: string; name: string; email?: string; role: string };
  onBack: () => void;
}

export const DoctorPatientView: React.FC<DoctorPatientViewProps> = ({ patientId, doctorId, doctorProfile, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'meds' | 'labs' | 'proposals'>('overview');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await webMCPEngine.execute('view_patient_as_doctor', { patientId, doctorId });
      if (!res.success) {
        setError(res.error?.message || 'Access denied. No active link for this patient.');
        setData(null);
      } else {
        setData(res.data as Record<string, unknown>);
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message || 'Failed to load patient record.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [patientId, doctorId]);

  const patientName = useMemo(() => {
    try {
      const link = localVault.getDoctorLinksForPatient(patientId).find(l => (l as unknown as { doctorId?: string; doctorUserId?: string; doctorEmail?: string }).doctorId === doctorId || (l as unknown as { doctorUserId?: string }).doctorUserId === doctorId || (doctorProfile.email && (l as unknown as { doctorEmail?: string }).doctorEmail === doctorProfile.email));
      if (link?.patientName) return link.patientName;
      const vaultAny = localVault as unknown as { doctorPatientLinks?: Map<string, unknown> };
      const all = vaultAny.doctorPatientLinks ? Array.from(vaultAny.doctorPatientLinks.values()).find((l) => (l as { patientId?: string }).patientId === patientId) as { patientName?: string } | undefined : undefined;
      if (all?.patientName) return all.patientName;
      return patientId;
    } catch { return patientId; }
  }, [patientId, doctorId, doctorProfile.email]);

  const permission: string = useMemo(() => {
    try {
      const link = localVault.getDoctorLinksForPatient(patientId).find(l => (l as unknown as { doctorId?: string; doctorUserId?: string; doctorEmail?: string }).doctorId === doctorId || (l as unknown as { doctorUserId?: string }).doctorUserId === doctorId || (doctorProfile.email && (l as unknown as { doctorEmail?: string }).doctorEmail === doctorProfile.email));
      return link?.permissionLevel || 'view_only';
    } catch { return 'view_only'; }
  }, [patientId, doctorId, doctorProfile.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-canvas-border text-body-sm font-semibold hover:bg-canvas-muted min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Back to My Patients
        </button>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <Shield className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-heading-md font-bold text-rose-900">Access denied</h3>
          <p className="text-body-sm text-rose-700">{error}</p>
          <p className="text-caption text-muted">Ask patient to link you via Family → My Doctors. Current doctor: {doctorProfile.name} ({doctorProfile.email || doctorId})</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-body-sm font-bold min-h-[44px]">Retry</button>
        </div>
      </div>
    );
  }

  const meds = useMemo(() => (data?.medications as unknown[] || []) as { id: string; genericName?: string; brandName?: string; name?: string; dosage?: string; frequency?: string; timingSlots?: string[]; withFood?: boolean; status?: string; indication?: string }[], [data]);
  const labs = useMemo(() => (data?.labs as unknown[] || []) as { id: string; marker: string; value?: number; normalizedValue?: number; unit?: string; normalizedUnit?: string; drawDate: string; referenceRange?: { low: number; high: number }; flag?: string }[], [data]);
  const conditions = useMemo(() => (data?.conditions as unknown[] || []) as { id: string; conditionName?: string; name?: string; status?: string }[], [data]);
  const allergies = useMemo(() => (data?.allergies as unknown[] || []) as { id: string; allergen: string; reaction: string; severity: string }[], [data]);
  const proposals = useMemo(() => { try { return localVault.getProposals(patientId).slice(0, 10); } catch { return []; } }, [patientId]);
  const dueCards = useMemo(() => { try { return localVault.getDueCards(patientId).filter((c) => c.status !== 'completed'); } catch { return []; } }, [patientId]);
  const dangers = useMemo(() => { try { return localVault.getDangerReports(patientId).slice(0,5); } catch { return []; } }, [patientId]);
  const sortedLabs = useMemo(() => [...labs].sort((a,b)=> new Date(a.drawDate).getTime()-new Date(b.drawDate).getTime()), [labs]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-canvas-border text-body-sm font-semibold hover:bg-canvas-muted min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> My Patients
        </button>
        <span className="text-caption px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hidden sm:inline-flex"><Shield className="w-3 h-3" /> Doctor view • {permission}</span>
      </div>

      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm shrink-0">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate">{patientName}</h2>
            <p className="text-caption text-muted font-mono truncate">{patientId} • Linked • {permission} access • {meds.length} meds • {labs.length} labs</p>
            <p className="text-caption text-emerald-700 font-semibold">Viewing as Dr. {doctorProfile.name} — read {permission==='view_only'?'only':permission} • patient’s vault isolation enforced</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-caption px-2 py-1 rounded-full bg-canvas-muted text-muted border border-canvas-border font-semibold">{new Date((data?.accessedAt as unknown as string) || Date.now()).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm overflow-x-auto scrollbar-none max-w-full">
        {([
          ['overview','Overview'],
          ['meds',`Medications (${meds.length})`],
          ['labs',`Labs (${labs.length})`],
          ['proposals',`Proposals (${proposals.length})`],
        ] as const).map(([k,label]) => (
          <button key={k} onClick={() => setActiveTab(k as unknown as typeof activeTab)} className={`px-3.5 py-2 rounded-lg font-bold whitespace-nowrap min-h-[36px] ${activeTab===k ? 'bg-white text-emerald-700 shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'}`}>{label}</button>
        ))}
      </div>

      {activeTab==='overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Pill className="w-4 h-4 text-sky-600" /> Active Medications</h3>
              {meds.length===0 ? <p className="text-body-sm text-muted">No active medications recorded.</p> : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {meds.slice(0,6).map((m) => (
                    <div key={m.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                      <p className="text-body-sm font-bold text-slate-900">{m.genericName || m.brandName || m.name} — {m.dosage}</p>
                      <p className="text-caption text-muted">{m.frequency} • {Array.isArray(m.timingSlots)? m.timingSlots.join(', '):''} {m.withFood? '• with food':''}</p>
                    </div>
                  ))}
                  {meds.length>6 && <p className="text-caption text-muted">+ {meds.length-6} more — see Medications tab</p>}
                </div>
              )}
            </div>
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-600" /> Recent Labs</h3>
              {labs.length===0 ? <p className="text-body-sm text-muted">No labs recorded.</p> : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {labs.slice(-6).reverse().map((l) => (
                    <div key={l.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 flex items-center justify-between gap-2">
                      <div><p className="text-body-sm font-bold text-slate-900">{l.marker}</p><p className="text-caption text-muted">{l.normalizedValue ?? l.value} {l.normalizedUnit ?? l.unit} • {new Date(l.drawDate).toLocaleDateString()}</p></div>
                      <span className={`text-caption px-2 py-0.5 rounded-full font-bold uppercase border ${String(l.flag).includes('CRITICAL') ? 'bg-rose-50 text-rose-700 border-rose-200' : String(l.flag).includes('HIGH')||String(l.flag).includes('LOW') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{l.flag || 'RECORDED'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Heart className="w-4 h-4 text-amber-600" /> Conditions & Allergies</h3>
              <div className="space-y-2">
                <div><p className="text-caption font-bold uppercase tracking-wider text-muted">Conditions ({conditions.length})</p>{conditions.length===0 ? <p className="text-caption text-muted">None recorded</p> : conditions.slice(0,4).map((c)=>(<p key={c.id} className="text-body-sm text-slate-800">• {c.conditionName || c.name} <span className="text-caption text-muted">({c.status})</span></p>))}</div>
                <div><p className="text-caption font-bold uppercase tracking-wider text-muted">Allergies ({allergies.length})</p>{allergies.length===0 ? <p className="text-caption text-muted">None recorded</p> : allergies.slice(0,4).map((a)=>(<p key={a.id} className="text-body-sm text-rose-700">• {a.allergen} — {a.reaction} <span className="text-caption">({a.severity})</span></p>))}</div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2"><Clock className="w-4 h-4" /> Due & Safety</h4>
              <p className="text-body-sm text-amber-900">{dueCards.length} due lab{dueCards.length!==1?'s':''} • {dangers.length} recent safety alert{dangers.length!==1?'s':''} • {proposals.filter(p=>p.status==='pending').length} pending proposal{proposals.filter(p=>p.status==='pending').length!==1?'s':''}</p>
              {dueCards.slice(0,2).map((d)=>(<div key={d.id} className="bg-white rounded-lg p-2 border border-amber-100"><p className="text-caption font-bold text-slate-900">{d.testPanel}</p><p className="text-caption text-muted">Due {new Date(d.dueDate).toLocaleDateString()} • {d.prescribedBy}</p></div>))}
              {dangers.slice(0,2).map((r)=>(<div key={(r as { reportId: string }).reportId} className="bg-white rounded-lg p-2 border border-rose-100"><p className="text-caption font-bold text-rose-900">{(r as unknown as { symptomType?: string; symptom?: string }).symptomType || (r as unknown as { symptom?: string }).symptom || 'Safety alert'} — {(r as unknown as { severity?: string; triagePriority?: string }).severity || (r as unknown as { triagePriority?: string }).triagePriority}</p></div>))}
              {dueCards.length===0 && dangers.length===0 && <p className="text-caption text-amber-700">No outstanding due cards or alerts.</p>}
            </div>
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4">
              <p className="text-caption text-muted flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Doctor audit: view logged at {new Date((data?.accessedAt as unknown as string) || Date.now()).toLocaleTimeString()} — immutable trail in patient’s audit log.</p>
              {permission!=='view_only' && <p className="text-caption text-emerald-700 font-semibold mt-1">You have {permission} — you can propose dosage changes via HomeLab tools; patient must approve.</p>}
              {permission==='view_only' && <p className="text-caption text-muted mt-1">View-only: you can read but not propose changes until patient upgrades your permission to manage/full.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab==='meds' && (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">All Medications — {meds.length}</h3>
          {meds.length===0 ? <p className="text-body-sm text-muted">No medications.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {meds.map((m)=>(
                <div key={m.id} className="rounded-xl border border-canvas-border bg-canvas-muted p-3 space-y-1">
                  <p className="text-body-sm font-bold text-slate-900">{m.genericName || m.brandName} • {m.dosage}</p>
                  <p className="text-caption text-muted">{m.frequency} • slots: {(m.timingSlots||[]).join(', ')} • {m.status}</p>
                  {m.indication && <p className="text-caption text-slate-600">Indication: {m.indication}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab==='labs' && (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">All Labs — {labs.length} sorted by date</h3>
          {labs.length===0 ? <p className="text-body-sm text-muted">No labs.</p> : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {sortedLabs.map((l)=>(
                <div key={l.id} className="rounded-xl border border-canvas-border bg-white p-3 flex items-center justify-between gap-3">
                  <div><p className="text-body-sm font-bold text-slate-900">{l.marker} — {l.normalizedValue ?? l.value} {l.normalizedUnit ?? l.unit}</p><p className="text-caption text-muted">{new Date(l.drawDate).toLocaleString()} • Ref {l.referenceRange?.low}–{l.referenceRange?.high}</p></div>
                  <span className="text-caption px-2 py-0.5 rounded-full border font-bold uppercase bg-canvas-muted">{l.flag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab==='proposals' && (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Proposals & Recent Activity</h3>
          {proposals.length===0 ? <p className="text-body-sm text-muted">No proposals.</p> : (
            <div className="space-y-2">
              {proposals.map((p)=>(
                <div key={p.id} className="rounded-xl border border-canvas-border bg-canvas-muted p-3">
                  <div className="flex items-center justify-between gap-2"><p className="text-body-sm font-bold text-slate-900">{p.type} — {p.medName}</p><span className={`text-caption px-2 py-0.5 rounded-full border uppercase font-bold ${p.status==='pending'?'bg-amber-50 text-amber-700 border-amber-200':p.status==='approved'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-100 text-slate-600 border-slate-200'}`}>{p.status}</span></div>
                  <p className="text-caption text-slate-600 mt-1">{p.reason || p.plainNarration || ''}</p>
                  <p className="text-caption text-muted font-mono">{new Date(p.timestamp).toLocaleString()} • Dr. {p.doctorName} • {p.proposedDose ? `${p.previousDose} → ${p.proposedDose}`:''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};