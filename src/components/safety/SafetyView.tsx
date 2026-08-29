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

export const SafetyView: React.FC<SafetyViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' }
}) => {
  const [activeTab, setActiveTab] = useState<'patient_safety' | 'doctor_triage' | 'calendar'>('patient_safety');
  const [dangerReports, setDangerReports] = useState<DangerSignReport[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);

  const loadData = () => {
    // Read-only vault loads — no per-view seeding (centralized src/core/vault/seed.ts owns baseline via main.tsx bootstrap).
    const reports = localVault.getDangerReports(patientId);
    setDangerReports(reports);

    const events = localVault.getCalendarEvents(patientId);
    setCalendarEvents(events);
  };

  // M2 Relevant-only: Safety listens to danger_report_added (alias danger_reported), calendar_event_added, proposal_created (alias proposal_submitted)
  // lab_* / medication_* / due_card_* are irrelevant — alias dispatch covers legacy names without double
  useEffect(() => {
    loadData();

    const guard = (p: any) => !p || !p.patientId || p.patientId === patientId;
    const mk = (h: () => void) => (payload: any) => { if (guard(payload)) h(); };

    const u1 = eventBus.on('danger_report_added', mk(loadData));
    const u2 = eventBus.on('calendar_event_added', mk(loadData));
    const u3 = eventBus.on('proposal_created', mk(loadData));

    return () => {
      u1();
      u2();
      u3();
    };
  }, [patientId]);

  const activeAlerts = dangerReports.filter((r) => r.triagePriority === 'URGENT' || r.triagePriority === 'EMERGENCY');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Safety Header & Emergency Button */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Get Help</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 font-bold border border-rose-500/30">
                Urgent
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Tell your care team quickly if something feels wrong — and see what happens next.
            </p>
          </div>
        </div>

        {/* Emergency Trigger & Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDangerModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all shadow-lg shadow-rose-600/30 animate-pulse"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>I need help now</span>
          </button>

          <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('patient_safety')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'patient_safety'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              What to do
            </button>
            <button
              onClick={() => setActiveTab('doctor_triage')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'doctor_triage'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Doctor's Actions
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              My Appointments
            </button>
          </div>
        </div>
      </div>

      {/* Active Danger Warning Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950/80 via-slate-50 to-white border-2 border-rose-500/50 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/40">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-700 uppercase tracking-wider">
                  Needs attention now
                </span>
                <span className="px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-700 text-[10px] font-bold border border-rose-200">
                  URGENT
                </span>
              </div>
              <p className="text-xs text-slate-800 font-semibold pt-0.5">
                Swelling in legs and high blood pressure reported — sent to Dr. Anita Patel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('doctor_triage')}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
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
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-slate-900">Immediate Escalation & First-Aid Guidance (SF1)</h3>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 rounded-2xl p-4 border border-rose-500/20 space-y-2">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    When to Call 911 or Visit Nearest ER Immediately:
                  </span>
                  <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                    <li>Crushing chest pain, tightness, or pain spreading to arm/jaw</li>
                    <li>Sudden severe difficulty breathing or gasping for air</li>
                    <li>Sudden numbness, facial drooping, or slurred speech</li>
                    <li>Uncontrolled heavy bleeding or coughing up blood</li>
                  </ul>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-sky-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-400" />
                    When to Report Danger Sign (Dr. Patel Review):
                  </span>
                  <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
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

          {/* Right Column: Active Emergency Alerts & Dossier Pinning (SF8) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-sky-400" />
                  <h3 className="text-sm font-bold text-slate-900">Safety Dossier Trail (SF8)</h3>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">Immutable</span>
              </div>

              <div className="space-y-3">
                {dangerReports.map((report) => (
                  <div
                    key={report.reportId}
                    className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-700">
                        {report.symptomTags.join(', ').replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-600 font-mono">
                        {new Date(report.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed">{report.freeText}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                      <span>Severity: <strong className="text-rose-400 uppercase">{report.severityRating}</strong></span>
                      <span className="text-emerald-400 font-medium">Logged to Dossier</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'doctor_triage' ? (
        <TriagePanel
          patientId={patientId}
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
        patientId={patientId}
        onReportSubmitted={() => loadData()}
      />

      <FollowupScheduler
        isOpen={isFollowupModalOpen}
        onClose={() => setIsFollowupModalOpen(false)}
        patientId={patientId}
        onScheduled={() => loadData()}
      />
    </div>
  );
};
