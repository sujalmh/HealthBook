import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Calendar,
  PhoneCall,
  Activity,
  HeartPulse,
  UserCheck,
  Stethoscope,
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  Download
} from 'lucide-react';
import { DangerSignModal } from './DangerSignModal';
import { TriagePanel } from './TriagePanel';
import { FollowupScheduler } from './FollowupScheduler';
import { CalendarView } from './CalendarView';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
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
  };
}

function deriveSafetyPatientId(passed: string, fallback?: string): string {
  if (passed && passed.trim() !== '' && passed !== 'patient-s-devi') return passed.trim();
  if (fallback && fallback.trim() !== '' && fallback !== 'patient-s-devi') return fallback.trim();
  try {
    const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    const ls = g?.localStorage || (typeof localStorage !== 'undefined' ? (localStorage as any) : undefined);
    if (ls) {
      const raw = ls.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const pid = parsed?.userId || parsed?.id || parsed?.patientId;
        if (typeof pid === 'string' && pid.trim() !== '') return pid.trim();
      }
    }
  } catch {}
  return passed || fallback || '';
}

export const SafetyView: React.FC<SafetyViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' }
}) => {
  const effectivePatientId = deriveSafetyPatientId(patientId, activeProfile?.userId);
  const [activeTab, setActiveTab] = useState<'patient_safety' | 'doctor_triage' | 'calendar'>('patient_safety');
  const [dangerReports, setDangerReports] = useState<DangerSignReport[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);

  const loadData = () => {
    // Read-only vault loads — uses effectivePatientId for isolation, danger triage via AI vision+text but still clinician path
    const reports = effectivePatientId ? localVault.getDangerReports(effectivePatientId) : [];
    setDangerReports(reports);

    const events = effectivePatientId ? localVault.getCalendarEvents(effectivePatientId) : [];
    setCalendarEvents(events);
  };

  // M2 Relevant-only: Safety listens to danger_report_added (alias danger_reported), calendar_event_added, proposal_created (alias proposal_submitted)
  // lab_* / medication_* / due_card_* are irrelevant — alias dispatch covers legacy names without double
  // Danger triage via AI vision+text inferred if document contains red flags but still requires clinician path
  useEffect(() => {
    loadData();

    const guard = (p: any) => !p || !p.patientId || p.patientId === effectivePatientId;
    const mk = (h: () => void) => (payload: any) => { if (guard(payload)) h(); };

    const u1 = eventBus.on('danger_report_added', mk(loadData));
    const u2 = eventBus.on('calendar_event_added', mk(loadData));
    const u3 = eventBus.on('proposal_created', mk(loadData));

    return () => {
      u1();
      u2();
      u3();
    };
  }, [effectivePatientId]);

  const activeAlerts = dangerReports.filter((r) => r.triagePriority === 'URGENT' || r.triagePriority === 'EMERGENCY');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Safety Header — tokenized, clinical urgency cohesive */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-clinical-red flex items-center justify-center border border-rose-200 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Get Help</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-rose-50 text-clinical-red font-bold border border-rose-200">
                Urgent
              </span>
            </div>
            <p className="text-body-sm text-muted">
              Tell your care team quickly if something feels wrong — and see what happens next.
            </p>
          </div>
        </div>

        {/* Emergency Trigger & Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDangerModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 min-h-[44px] w-full sm:w-auto"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>I need help now</span>
          </button>

          <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border overflow-x-auto scrollbar-none max-w-full shadow-xs">
            <button
              onClick={() => setActiveTab('patient_safety')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[36px] ${
                activeTab === 'patient_safety'
                  ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
                  : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              What to do
            </button>
            <button
              onClick={() => setActiveTab('doctor_triage')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[36px] ${
                activeTab === 'doctor_triage'
                  ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
                  : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              Doctor's Actions
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[36px] ${
                activeTab === 'calendar'
                  ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
                  : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              My Appointments
            </button>
          </div>
        </div>
      </div>

      {/* Active Danger Warning Banner — light clinical amber/red */}
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
              onClick={() => setActiveTab('doctor_triage')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors min-h-[40px]"
            >
              Review Actions
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'patient_safety' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Safety Advice & Red Flags */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-canvas-border pb-3">
                <ShieldAlert className="w-5 h-5 text-clinical-red" />
                <h3 className="text-heading-md text-slate-900">Immediate Escalation & First-Aid Guidance</h3>
              </div>

              <div className="space-y-3">
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 space-y-2">
                  <span className="text-body-sm font-bold text-clinical-red flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-clinical-red" />
                    When to call 911 or visit nearest ER immediately:
                  </span>
                  <ul className="text-body-sm text-slate-700 space-y-1 list-disc list-inside">
                    <li>Crushing chest pain, tightness, or pain spreading to arm/jaw</li>
                    <li>Sudden severe difficulty breathing or gasping for air</li>
                    <li>Sudden numbness, facial drooping, or slurred speech</li>
                    <li>Uncontrolled heavy bleeding or coughing up blood</li>
                  </ul>
                </div>

                <div className="bg-canvas-muted rounded-xl p-4 border border-canvas-border space-y-2">
                  <span className="text-body-sm font-bold text-accent flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-accent" />
                    When to report danger sign (Clinician review):
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

            {/* Prescribed Calendar Snippet */}
            <CalendarView
              events={calendarEvents}
              onAddEventClick={() => setIsFollowupModalOpen(true)}
            />
          </div>

          {/* Right Column: Active Emergency Alerts & Dossier Pinning */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-canvas-border pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-clinical-blue" />
                  <h3 className="text-heading-md text-slate-900">Safety Dossier Trail</h3>
                </div>
                <span className="text-caption text-muted font-mono">Immutable</span>
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
                      <span className="text-clinical-emerald font-medium">Logged to Dossier</span>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'doctor_triage' ? (
        <TriagePanel
          patientId={effectivePatientId}
          dangerReports={dangerReports}
          onActionDispatched={() => loadData()}
        />
      ) : (
        <CalendarView
          events={calendarEvents}
          onAddEventClick={() => setIsFollowupModalOpen(true)}
        />
      )}

      {/* Modals */}
      <DangerSignModal
        isOpen={isDangerModalOpen}
        onClose={() => setIsDangerModalOpen(false)}
        patientId={effectivePatientId}
        onReportSubmitted={() => loadData()}
      />

      <FollowupScheduler
        isOpen={isFollowupModalOpen}
        onClose={() => setIsFollowupModalOpen(false)}
        patientId={effectivePatientId}
        onScheduled={() => loadData()}
      />
    </div>
  );
};
