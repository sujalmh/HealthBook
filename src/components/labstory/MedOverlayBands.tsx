import React, { useState } from 'react';
import { Pill, Info, Check, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import type { MedicationRecord } from '@/types/vault';

export interface TimelineMedication {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  category: 'antihypertensive' | 'steroid' | 'nsaid' | 'antidiabetic' | 'statin' | 'anticoagulant' | 'other';
  startDate: string;
  stopDate?: string;
  status: 'active' | 'stopped' | 'held' | 'tapered';
  colorHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  indication?: string;
  prescribedBy?: string;
  notes?: string;
}

interface MedOverlayBandsProps {
  minTime: number; // epoch ms
  maxTime: number; // epoch ms
  activeMeds?: MedicationRecord[];
  className?: string;
  onMedToggle?: (medId: string, visible: boolean) => void;
}

export const MedOverlayBands: React.FC<MedOverlayBandsProps> = ({
  minTime,
  maxTime,
  activeMeds = [],
  className = '',
  onMedToggle
}) => {
  // Built-in rich timeline medications covering the longitudinal 2022-2026 timeline
  const defaultTimelineMeds: TimelineMedication[] = [
    {
      id: 'med_lisinopril',
      name: 'Lisinopril',
      genericName: 'Lisinopril',
      dosage: '10mg → 20mg Daily',
      category: 'antihypertensive',
      startDate: '2022-01-10T00:00:00Z',
      stopDate: '2026-08-25T00:00:00Z',
      status: 'stopped',
      colorHex: '#38bdf8', // sky-400
      bgClass: 'bg-sky-500/20 hover:bg-sky-500/30',
      borderClass: 'border-sky-500/40',
      textClass: 'text-sky-300',
      indication: 'Hypertension & Cardioprotection',
      prescribedBy: 'Dr. Anita Patel, MD',
      notes: 'Discontinued on hospital discharge due to acute eGFR decline (32 mL/min).'
    },
    {
      id: 'med_metformin',
      name: 'Metformin',
      genericName: 'Metformin',
      dosage: '500mg → 1000mg BID → 500mg Daily',
      category: 'antidiabetic',
      startDate: '2023-01-20T00:00:00Z',
      status: 'active',
      colorHex: '#34d399', // emerald-400
      bgClass: 'bg-emerald-500/20 hover:bg-emerald-500/30',
      borderClass: 'border-emerald-500/40',
      textClass: 'text-emerald-300',
      indication: 'Type 2 Diabetes Glycemic Control',
      prescribedBy: 'Dr. S. Kumar, MD',
      notes: 'Titrated to 1000mg BID in 2024; reduced to 500mg Daily post-AKI to avoid lactic acidosis.'
    },
    {
      id: 'med_prednisone',
      name: 'Prednisone (Burst)',
      genericName: 'Prednisone',
      dosage: '20mg Daily (14-day taper)',
      category: 'steroid',
      startDate: '2023-11-01T00:00:00Z',
      stopDate: '2023-11-20T00:00:00Z',
      status: 'stopped',
      colorHex: '#c084fc', // purple-400
      bgClass: 'bg-purple-500/20 hover:bg-purple-500/30',
      borderClass: 'border-purple-500/40',
      textClass: 'text-purple-300',
      indication: 'Osteoarthritis flare & joint inflammation',
      prescribedBy: 'Rheumatology Clinic',
      notes: 'Directly caused temporary fasting glucose spike to 145 mg/dL during therapy.'
    },
    {
      id: 'med_atorvastatin',
      name: 'Atorvastatin',
      genericName: 'Atorvastatin',
      dosage: '20mg → 40mg Bedtime',
      category: 'statin',
      startDate: '2024-08-01T00:00:00Z',
      status: 'active',
      colorHex: '#2dd4bf', // teal-400
      bgClass: 'bg-teal-500/20 hover:bg-teal-500/30',
      borderClass: 'border-teal-500/40',
      textClass: 'text-teal-300',
      indication: 'Hyperlipidemia & Atherosclerosis prevention',
      prescribedBy: 'Cardiology Clinic',
      notes: 'Titration in Aug 2024 led to sustained LDL reduction from 125 to 88 mg/dL.'
    },
    {
      id: 'med_ibuprofen',
      name: 'Ibuprofen (OTC NSAID)',
      genericName: 'Ibuprofen',
      dosage: '800mg TID PRN',
      category: 'nsaid',
      startDate: '2026-08-15T00:00:00Z',
      stopDate: '2026-08-28T00:00:00Z',
      status: 'stopped',
      colorHex: '#f87171', // red-400
      bgClass: 'bg-rose-500/25 hover:bg-rose-500/35',
      borderClass: 'border-rose-500/50',
      textClass: 'text-rose-300',
      indication: 'Acute knee osteoarthritis pain',
      prescribedBy: 'Self-administered OTC',
      notes: '⚠️ CAUSAL ANOMALY: Triggered acute renal vasoconstriction & eGFR drop to 28 mL/min.'
    },
    {
      id: 'med_apixaban',
      name: 'Apixaban (Eliquis)',
      genericName: 'Apixaban',
      dosage: '5mg PO BID',
      category: 'anticoagulant',
      startDate: '2026-08-25T00:00:00Z',
      status: 'active',
      colorHex: '#fbbf24', // amber-400
      bgClass: 'bg-amber-500/20 hover:bg-amber-500/30',
      borderClass: 'border-amber-500/40',
      textClass: 'text-amber-300',
      indication: 'Stroke prevention in Atrial Fibrillation',
      prescribedBy: 'Inpatient Cardiology',
      notes: 'Initiated at hospital discharge; require monitoring for bleeding with OTCs.'
    }
  ];

  const [visibleMeds, setVisibleMeds] = useState<Record<string, boolean>>({
    med_lisinopril: true,
    med_metformin: true,
    med_prednisone: true,
    med_atorvastatin: true,
    med_ibuprofen: true,
    med_apixaban: true
  });

  const [selectedMed, setSelectedMed] = useState<TimelineMedication | null>(null);

  const toggleMed = (medId: string) => {
    const next = !visibleMeds[medId];
    setVisibleMeds((prev) => ({ ...prev, [medId]: next }));
    if (onMedToggle) {
      onMedToggle(medId, next);
    }
  };

  const timeSpan = Math.max(maxTime - minTime, 1);

  const getPositionPercent = (isoDate: string): number => {
    const t = new Date(isoDate).getTime();
    const pct = ((t - minTime) / timeSpan) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const getWidthPercent = (startIso: string, stopIso?: string): number => {
    const startPct = getPositionPercent(startIso);
    const endPct = stopIso ? getPositionPercent(stopIso) : 100;
    return Math.max(2, endPct - startPct);
  };

  return (
    <div className={`bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 ${className}`}>
      {/* Header with Info and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Pill className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              Medication Overlay Bands (LS4)
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                Timeline Aligned
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Active & historical drug courses overlaid on the biomarker timeline to visualize causal impacts.
            </p>
          </div>
        </div>

        {/* Legend / Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {defaultTimelineMeds.map((med) => {
            const isVis = visibleMeds[med.id] !== false;
            return (
              <button
                key={med.id}
                onClick={() => toggleMed(med.id)}
                className={`text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all border ${
                  isVis
                    ? `${med.bgClass} ${med.borderClass} ${med.textClass}`
                    : 'bg-slate-950/60 text-slate-500 border-slate-800 opacity-60'
                }`}
                title={`Toggle ${med.name}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isVis ? med.colorHex : '#64748b' }}
                />
                <span>{med.name}</span>
                {isVis ? <Eye className="w-3 h-3 opacity-60" /> : <EyeOff className="w-3 h-3 opacity-60" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline Visualization Bands Container */}
      <div className="relative pt-1 pb-2 space-y-1.5">
        {/* Subtle grid ticks matching chart width */}
        <div className="absolute inset-0 pointer-events-none flex justify-between">
          <div className="w-px h-full bg-slate-800/40" />
          <div className="w-px h-full bg-slate-800/40" />
          <div className="w-px h-full bg-slate-800/40" />
          <div className="w-px h-full bg-slate-800/40" />
          <div className="w-px h-full bg-slate-800/40" />
        </div>

        {defaultTimelineMeds
          .filter((m) => visibleMeds[m.id] !== false)
          .map((med) => {
            const left = getPositionPercent(med.startDate);
            const width = getWidthPercent(med.startDate, med.stopDate);
            const isSelected = selectedMed?.id === med.id;

            return (
              <div key={med.id} className="relative h-7 w-full flex items-center">
                {/* Horizontal Band */}
                <button
                  onClick={() => setSelectedMed(selectedMed?.id === med.id ? null : med)}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`
                  }}
                  className={`absolute h-6 rounded-lg px-2 flex items-center justify-between text-left text-[11px] font-semibold transition-all border shadow-sm cursor-pointer truncate z-10 ${med.bgClass} ${med.borderClass} ${med.textClass} ${
                    isSelected ? 'ring-2 ring-white/50 scale-[1.01]' : ''
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    {med.category === 'nsaid' && <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />}
                    <span className="font-bold">{med.name}</span>
                    <span className="opacity-80 text-[10px] hidden sm:inline font-normal">({med.dosage})</span>
                  </span>

                  <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-black/30 shrink-0 ml-1">
                    {med.status.toUpperCase()}
                  </span>
                </button>
              </div>
            );
          })}
      </div>

      {/* Selected Medication Details Card */}
      {selectedMed && (
        <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4 animate-fade-in text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-sm">{selectedMed.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${selectedMed.bgClass} ${selectedMed.borderClass} ${selectedMed.textClass}`}>
                {selectedMed.dosage}
              </span>
              <span className="text-slate-400 text-[11px]">
                {new Date(selectedMed.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                {selectedMed.stopDate ? ` → ${new Date(selectedMed.stopDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' → Ongoing'}
              </span>
            </div>

            <p className="text-slate-300 font-medium">{selectedMed.notes}</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
              <span>Indication: <strong className="text-slate-300">{selectedMed.indication}</strong></span>
              <span>•</span>
              <span>Prescriber: <strong className="text-slate-300">{selectedMed.prescribedBy}</strong></span>
            </div>
          </div>

          <button
            onClick={() => setSelectedMed(null)}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-slate-800 rounded-lg hover:bg-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
