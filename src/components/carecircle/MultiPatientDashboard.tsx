import React, { useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  Calendar,
  HeartPulse,
  Activity,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Clock,
  Pill
} from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';

interface MultiPatientDashboardProps {
  onSelectPatient: (patientId: string) => void;
}

interface PatientSummaryCard {
  id: string;
  name: string;
  relationship: string;
  age: number | string;
  conditions: string[];
  dueLabsCount: number;
  pendingProposalsCount: number;
  activeDangerAlertsCount: number;
  nextEvent: string;
  status: 'critical' | 'attention_needed' | 'stable';
}

export const MultiPatientDashboard: React.FC<MultiPatientDashboardProps> = ({
  onSelectPatient
}) => {
  const patients: PatientSummaryCard[] = useMemo(() => {
    // Vault-derived family patients — no hardcoded Mother/Father/Child mocks.
    let primaryId = '';
    try {
      const raw = localStorage.getItem('healthbook_active_user');
      if (raw) primaryId = JSON.parse(raw)?.userId || '';
    } catch { /* intentionally empty */ }
    if (!primaryId) return [];
    const links = localVault.getCaregiverLinks(primaryId);
    if (links.length === 0) return [];
    return links.map((link) => {
      const pid = link.patientId || link.linkId;
      const conditions = localVault.getConditions(pid).map((c) => (c as unknown as { name?: string; code?: string }).name || (c as unknown as { code?: string }).code || 'Condition').slice(0, 3);
      const dueCards = localVault.getDueCards(pid).filter((c) => (c as unknown as { status?: string }).status !== 'completed');
      const pending = localVault.getPendingProposals(pid);
      const dangers = localVault.getDangerReports(pid).filter((r) => {
        const tri = (r as unknown as { triagePriority?: string }).triagePriority;
        return tri === 'URGENT' || tri === 'EMERGENCY';
      });
      const events = localVault.getCalendarEvents(pid);
      const nextEv = events.length > 0 ? events[0].title : 'No upcoming events';
      const hasDanger = dangers.length > 0;
      const hasDue = dueCards.length > 0;
      return {
        id: link.linkId,
        name: link.caregiverName || link.patientName || 'Family member',
        relationship: link.relationship || 'Family',
        age: '—',
        conditions: conditions.length ? conditions : ['No conditions recorded'],
        dueLabsCount: dueCards.length,
        pendingProposalsCount: pending.length,
        activeDangerAlertsCount: dangers.length,
        nextEvent: nextEv,
        status: hasDanger ? 'critical' : hasDue ? 'attention_needed' : 'stable',
      } as PatientSummaryCard;
    });
  }, []);

  if (patients.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">Everyone I Care For</h3>
        </div>
        <div className="bg-canvas-muted rounded-xl p-8 text-center border border-dashed border-canvas-border">
          <Users className="w-8 h-8 text-muted-light mx-auto mb-2" />
          <p className="text-body-sm font-semibold text-slate-900">No linked family profiles yet</p>
          <p className="text-body-sm text-muted">Add a family member in Family List → Manage Access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">
            Everyone I Care For
          </h3>
        </div>
        <span className="text-xs text-slate-600">{patients.length} Linked Family Profile{patients.length === 1 ? '' : 's'}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {patients.map((p) => {
          const isCritical = p.status === 'critical';
          const isAttention = p.status === 'attention_needed';

          return (
            <div
              key={p.id}
              onClick={() => onSelectPatient(p.id)}
              className={`cursor-pointer rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md space-y-4 ${
                isCritical
                  ? 'bg-rose-50 border-rose-200'
                  : isAttention
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-canvas-card border-canvas-border hover:border-primary-border'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                    <span className="text-xs text-slate-600">({p.relationship}, {p.age})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.conditions.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] font-medium px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-700 border-rose-200'
                      : isAttention
                      ? 'bg-amber-500/20 text-amber-700 border-amber-200'
                      : 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {p.status.replace('_', ' ')}
                </span>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-body-sm">
                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold">Danger alerts</div>
                  <div
                    className={`text-heading-md font-bold ${
                      p.activeDangerAlertsCount > 0 ? 'text-clinical-red font-bold' : 'text-muted'
                    }`}
                  >
                    {p.activeDangerAlertsCount}
                  </div>
                </div>

                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold">Due labs</div>
                  <div
                    className={`text-heading-md font-bold ${
                      p.dueLabsCount > 0 ? 'text-clinical-amber font-bold' : 'text-muted'
                    }`}
                  >
                    {p.dueLabsCount}
                  </div>
                </div>

                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold">Proposals</div>
                  <div
                    className={`text-heading-md font-bold ${
                      p.pendingProposalsCount > 0 ? 'text-clinical-blue font-bold' : 'text-muted'
                    }`}
                  >
                    {p.pendingProposalsCount}
                  </div>
                </div>
              </div>

              {/* Next Scheduled Milestone */}
              <div className="bg-canvas-muted rounded-xl p-2.5 border border-canvas-border flex items-center justify-between text-body-sm text-slate-700">
                <span className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{p.nextEvent}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
