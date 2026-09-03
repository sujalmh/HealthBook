import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  Clock,
  Info,
  Stethoscope,
  Calendar,
} from 'lucide-react';
import { DangerSignModal } from './DangerSignModal';
import { TriagePanel } from './TriagePanel';
import { FollowupScheduler } from './FollowupScheduler';
import { CalendarView } from './CalendarView';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import type { DangerSignReport } from '@/types/safety';
import type { CalendarEventRecord } from '@/types/vault';

interface SafetyViewProps {
  patientId: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
  };
}

export const SafetyView: React.FC<SafetyViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient', permissionLevel: 'manage' as const }
}) => {
  const effectivePatientId = resolvePatientId(patientId, activeProfile?.userId);
  const [activeTab, setActiveTab] = useState<'patient_safety' | 'doctor_triage' | 'calendar'>('patient_safety');
  const permissionLevel = (activeProfile as unknown as { permissionLevel?: "view_only" | "manage" | "full" })?.permissionLevel || 'manage';
  const profileRole = activeProfile?.role || 'patient';
  const isViewOnly = permissionLevel === 'view_only';
  const canAccessDoctorTriage = profileRole === 'doctor' || permissionLevel === 'full';

  const handleTabChange = (tab: 'patient_safety' | 'doctor_triage' | 'calendar') => {
    if (tab === 'doctor_triage' && !canAccessDoctorTriage) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Doctor actions — requires clinician login (PERMISSION_DENIED)' });
      return;
    }
    setActiveTab(tab);
  };
  const handleHelpNow = () => {
    if (isViewOnly) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Permission denied: View-only cannot report danger signs (PERMISSION_DENIED)' });
      return;
    }
    setIsDangerModalOpen(true);
  };
  const [dangerReports, setDangerReports] = useState<DangerSignReport[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);

  const loadData = () => {

    const reports = effectivePatientId ? localVault.getDangerReports(effectivePatientId) : [];
    setDangerReports(reports);

    const events = effectivePatientId ? localVault.getCalendarEvents(effectivePatientId) : [];
    setCalendarEvents(events);
  };

  useEffect(() => {
    loadData();

    const guard = (p: unknown) => {
      const pid = (p as { patientId?: string })?.patientId;
      return !p || !pid || pid === effectivePatientId;
    };
    const mk = (h: () => void) => (payload: unknown) => { if (guard(payload)) h(); };

    const u1 = eventBus.on('danger_report_added', mk(loadData) as (p: unknown) => void);
    const u2 = eventBus.on('calendar_event_added', mk(loadData) as (p: unknown) => void);
    const u3 = eventBus.on('proposal_created', mk(loadData) as (p: unknown) => void);
    const u4 = eventBus.on('vault_synced' as unknown as string, loadData as unknown as () => void);

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [effectivePatientId]);

  const activeAlerts = dangerReports.filter((r) => r.triagePriority === 'URGENT' || r.triagePriority === 'EMERGENCY');

  return (
    <div className="space-y-4 animate-fade-in">
      {}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Get Help</h2>
          {activeAlerts.length > 0 && (
            <span className="text-caption px-2 py-0.5 rounded-full bg-rose-50 text-clinical-red font-bold border border-rose-200">
              Urgent
            </span>
          )}
        </div>

        {}
        <button
          onClick={handleHelpNow}
          disabled={false}
          aria-disabled={isViewOnly}
          title={isViewOnly ? 'View-only: cannot report — Permission denied (PERMISSION_DENIED)' : undefined}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md min-h-[44px] w-full ${
            isViewOnly ? 'bg-slate-300 text-slate-600 cursor-not-allowed opacity-60 shadow-none' : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>I need help now</span>
        </button>

        <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border max-w-full shadow-xs overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleTabChange('patient_safety')}
              title="What to do"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[40px] shrink-0 ${
                activeTab === 'patient_safety'
                  ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
                  : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>Guide</span>
            </button>
            <button
              onClick={() => handleTabChange('doctor_triage')}
              aria-disabled={!canAccessDoctorTriage}
              title={!canAccessDoctorTriage ? 'Doctor actions — requires clinician login (PERMISSION_DENIED)' : 'Doctor actions'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[40px] shrink-0 ${
                activeTab === 'doctor_triage' && canAccessDoctorTriage
                  ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
                  : !canAccessDoctorTriage
                    ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60'
                    : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              <Stethoscope className="w-4 h-4 shrink-0" />
              <span>Doctor</span>
            </button>
            <button
              onClick={() => handleTabChange('calendar')}
              title="My appointments"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[40px] shrink-0 ${
                activeTab === 'calendar'
                  ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
                  : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Visits</span>
            </button>
          </div>
      </div>

      {}
      {activeAlerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-clinical-red text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-caption text-clinical-red uppercase tracking-wider">
                  Needs attention now
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-clinical-red text-[10px] font-bold border border-rose-200">
                  URGENT
                </span>
              </div>
              <p className="text-body-sm text-slate-800 font-semibold pt-0.5">
                Swelling in legs and high blood pressure reported — sent to your care team.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => handleTabChange('doctor_triage')}
              aria-disabled={!canAccessDoctorTriage}
              title={!canAccessDoctorTriage ? 'Doctor actions — requires clinician login' : undefined}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors min-h-[40px] ${!canAccessDoctorTriage ? 'bg-slate-300 text-slate-600 cursor-not-allowed opacity-60' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
            >
              Review Actions
            </button>
          </div>
        </div>
      )}

      {}
      {activeTab === 'patient_safety' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-canvas-border pb-3">
                <ShieldAlert className="w-5 h-5 text-clinical-red" />
                <h3 className="text-heading-md text-slate-900">Emergencies & warning signs</h3>
              </div>

              <div className="space-y-3">
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 space-y-2">
                  <span className="text-sm font-bold text-clinical-red flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-clinical-red" />
                    Call 911 or go to ER now:
                  </span>
                  <ul className="text-body-sm text-slate-700 space-y-1 list-disc list-inside">
                    <li>Crushing chest pain, tightness, or pain spreading to arm/jaw</li>
                    <li>Sudden severe difficulty breathing or gasping for air</li>
                    <li>Sudden numbness, facial drooping, or slurred speech</li>
                    <li>Uncontrolled heavy bleeding or coughing up blood</li>
                  </ul>
                </div>

                <div className="bg-canvas-muted rounded-xl p-4 border border-canvas-border space-y-2">
                  <span className="text-sm font-bold text-accent flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-accent" />
                    Report to your clinician:
                  </span>
                  <ul className="text-body-sm text-slate-700 space-y-1 list-disc list-inside">
                    <li>Sudden swelling in both feet, ankles, or legs (edema)</li>
                    <li>Rapid weight gain exceeding 3 lbs in 24 hours</li>
                    <li>Blood pressure readings consistently above 170/100 mmHg</li>
                    <li>Persistent dizziness when standing up</li>
                  </ul>
                </div>
              </div>
            </div>

            {}
            <CalendarView
              events={calendarEvents}
              onAddEventClick={() => setIsFollowupModalOpen(true)}
            />
          </div>

          {}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-canvas-border pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-clinical-blue" />
                  <h3 className="text-heading-md text-slate-900">My reports</h3>
                </div>
              </div>

              {dangerReports.length === 0 ? (
                <div className="bg-canvas-muted rounded-xl p-6 text-center border border-canvas-border">
                  <ShieldAlert className="w-8 h-8 text-muted-light mx-auto mb-2" />
                  <p className="text-body-sm font-semibold text-slate-900">No danger reports yet</p>
                  <p className="text-body-sm text-muted">Reported signs will appear here with triage status.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dangerReports.map((report) => (
                    <div
                      key={report.reportId}
                      className="bg-canvas-muted rounded-xl p-4 border border-canvas-border space-y-2 text-body-sm"
                    >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-clinical-red">
                        {report.symptomTags.join(', ').replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-caption text-muted font-mono">
                        {new Date(report.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed">{report.freeText}</p>

                    <div className="flex items-center justify-between text-caption text-muted pt-2 border-t border-canvas-border">
                      <span>Severity: <strong className="text-clinical-red uppercase">{report.severityRating}</strong></span>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'doctor_triage' ? (
        canAccessDoctorTriage ? (
          <TriagePanel
            patientId={effectivePatientId}
            dangerReports={dangerReports}
            activeProfile={activeProfile as unknown as { userId: string; name: string; role: string; isProxy?: boolean; onBehalfOf?: string; permissionLevel?: "view_only" | "manage" | "full" }}
            onActionDispatched={() => loadData()}
          />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-2" data-testid="doctor-triage-restricted">
            <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
            <h3 className="text-heading-md text-slate-900">Doctor actions — requires clinician login</h3>
            <p className="text-body-sm text-muted">Access restricted — Doctor triage is available only to clinicians or caregivers with full permissions. View-only cannot dispatch doctor orders. (PERMISSION_DENIED)</p>
            <button onClick={() => handleTabChange('patient_safety')} className="mt-2 px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50">Go to What to do</button>
          </div>
        )
      ) : (
        <CalendarView
          events={calendarEvents}
          onAddEventClick={() => {
            if (isViewOnly) {
              eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Permission denied: View-only cannot schedule (PERMISSION_DENIED)' });
              return;
            }
            setIsFollowupModalOpen(true);
          }}
        />
      )}

      <DangerSignModal
        isOpen={isDangerModalOpen}
        onClose={() => setIsDangerModalOpen(false)}
        patientId={effectivePatientId}
        activeProfile={activeProfile as unknown as { userId: string; name: string; role: string; isProxy?: boolean; onBehalfOf?: string; permissionLevel?: "view_only" | "manage" | "full" }}
        onReportSubmitted={() => loadData()}
      />

      <FollowupScheduler
        isOpen={isFollowupModalOpen}
        onClose={() => setIsFollowupModalOpen(false)}
        patientId={effectivePatientId}
        activeProfile={activeProfile as unknown as { userId: string; name: string; role: string; isProxy?: boolean; onBehalfOf?: string; permissionLevel?: "view_only" | "manage" | "full" }}
        onScheduled={() => loadData()}
      />
    </div>
  );
};

