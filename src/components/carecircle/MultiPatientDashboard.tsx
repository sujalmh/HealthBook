import React from 'react';
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

interface MultiPatientDashboardProps {
  onSelectPatient: (patientId: string) => void;
}

interface PatientSummaryCard {
  id: string;
  name: string;
  relationship: string;
  age: number;
  conditions: string[];
  dueLabsCount: number;
  pendingProposalsCount: number;
  activeDangerAlertsCount: number;
  nextEvent: string;
  status: 'critical' | 'attention_needed' | 'stable';
}

const PATIENTS: PatientSummaryCard[] = [
  {
    id: 'patient-s-devi',
    name: 'Smt. Shanti Devi',
    relationship: 'Mother',
    age: 78,
    conditions: ['CKD Stage 3b', 'Hypertension', 'Type 2 Diabetes'],
    dueLabsCount: 1,
    pendingProposalsCount: 1,
    activeDangerAlertsCount: 1,
    nextEvent: 'Dr. Patel Clinic Follow-Up (In 3 Days)',
    status: 'critical'
  },
  {
    id: 'patient-h-jenkins',
    name: 'Harold Jenkins',
    relationship: 'Father-in-law',
    age: 80,
    conditions: ['Heart Failure', 'Osteoarthritis', 'Hypertension'],
    dueLabsCount: 1,
    pendingProposalsCount: 0,
    activeDangerAlertsCount: 0,
    nextEvent: 'Creatinine & Potassium Lab (In 14 Days)',
    status: 'attention_needed'
  },
  {
    id: 'patient-child-003',
    name: 'Aarav Sharma',
    relationship: 'Child / Dependent',
    age: 8,
    conditions: ['Mild Pediatric Asthma'],
    dueLabsCount: 0,
    pendingProposalsCount: 0,
    activeDangerAlertsCount: 0,
    nextEvent: 'Annual Pediatric Checkup (In 4 Months)',
    status: 'stable'
  }
];

export const MultiPatientDashboard: React.FC<MultiPatientDashboardProps> = ({
  onSelectPatient
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Multi-Patient Caregiver Command Center (G6)
          </h3>
        </div>
        <span className="text-xs text-slate-400">3 Linked Family Profiles</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PATIENTS.map((p) => {
          const isCritical = p.status === 'critical';
          const isAttention = p.status === 'attention_needed';

          return (
            <div
              key={p.id}
              onClick={() => onSelectPatient(p.id)}
              className={`cursor-pointer rounded-3xl border p-5 transition-all shadow-xl hover:scale-[1.01] space-y-4 ${
                isCritical
                  ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/40 shadow-rose-500/5'
                  : isAttention
                  ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-500/5'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-100">{p.name}</h4>
                    <span className="text-xs text-slate-400">({p.relationship}, {p.age})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.conditions.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] font-medium px-2 py-0.2 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : isAttention
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {p.status.replace('_', ' ')}
                </span>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-semibold">Danger Alerts</div>
                  <div
                    className={`text-sm font-bold ${
                      p.activeDangerAlertsCount > 0 ? 'text-rose-400 font-black' : 'text-slate-400'
                    }`}
                  >
                    {p.activeDangerAlertsCount}
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-semibold">Due Labs</div>
                  <div
                    className={`text-sm font-bold ${
                      p.dueLabsCount > 0 ? 'text-amber-400 font-black' : 'text-slate-400'
                    }`}
                  >
                    {p.dueLabsCount}
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-semibold">Proposals</div>
                  <div
                    className={`text-sm font-bold ${
                      p.pendingProposalsCount > 0 ? 'text-sky-400 font-black' : 'text-slate-400'
                    }`}
                  >
                    {p.pendingProposalsCount}
                  </div>
                </div>
              </div>

              {/* Next Scheduled Milestone */}
              <div className="bg-slate-950/50 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{p.nextEvent}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
