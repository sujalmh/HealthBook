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
    id: '',
    name: 'Patient',
    relationship: 'Mother',
    age: 78,
    conditions: ['CKD Stage 3b', 'Hypertension', 'Type 2 Diabetes'],
    dueLabsCount: 1,
    pendingProposalsCount: 1,
    activeDangerAlertsCount: 1,
    nextEvent: 'Clinic Follow-Up (In 3 Days)',
    status: 'critical'
  },
  {
    id: 'patient-h-jenkins',
    name: 'Patient',
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
    name: 'Child Patient',
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
          <h3 className="text-sm font-bold text-slate-900">
            Multi-Patient Caregiver Command Center (G6)
          </h3>
        </div>
        <span className="text-xs text-slate-600">3 Linked Family Profiles</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PATIENTS.map((p) => {
          const isCritical = p.status === 'critical';
          const isAttention = p.status === 'attention_needed';

          return (
            <div
              key={p.id}
              onClick={() => onSelectPatient(p.id)}
              className={`cursor-pointer rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md hover:scale-[1.01] space-y-4 ${
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
                      ? 'bg-rose-500/20 text-rose-700 border-rose-200 animate-pulse'
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
                      p.activeDangerAlertsCount > 0 ? 'text-clinical-red font-black' : 'text-muted'
                    }`}
                  >
                    {p.activeDangerAlertsCount}
                  </div>
                </div>

                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold">Due labs</div>
                  <div
                    className={`text-heading-md font-bold ${
                      p.dueLabsCount > 0 ? 'text-clinical-amber font-black' : 'text-muted'
                    }`}
                  >
                    {p.dueLabsCount}
                  </div>
                </div>

                <div className="bg-canvas-muted rounded-xl p-2 border border-canvas-border">
                  <div className="text-caption text-muted font-semibold">Proposals</div>
                  <div
                    className={`text-heading-md font-bold ${
                      p.pendingProposalsCount > 0 ? 'text-clinical-blue font-black' : 'text-muted'
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
