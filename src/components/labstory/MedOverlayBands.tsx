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
      colorHex: '#4F46E5',
      bgClass: 'bg-primary-light hover:brightness-95',
      borderClass: 'border-primary-border',
      textClass: 'text-primary-text',
      indication: 'Hypertension & Cardioprotection',
      prescribedBy: 'Your doctor',
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
      colorHex: '#10B981',
      bgClass: 'bg-emerald-50 hover:bg-emerald-100',
      borderClass: 'border-emerald-200',
      textClass: 'text-emerald-700',
      indication: 'Type 2 Diabetes Glycemic Control',
      prescribedBy: 'Your doctor',
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
      colorHex: '#A855F7',
      bgClass: 'bg-purple-50 hover:bg-purple-100',
      borderClass: 'border-purple-200',
      textClass: 'text-purple-700',
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
      colorHex: '#14B8A6',
      bgClass: 'bg-teal-50 hover:bg-teal-100',
      borderClass: 'border-teal-200',
      textClass: 'text-teal-700',
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
      colorHex: '#EF4444',
      bgClass: 'bg-rose-50 hover:bg-rose-100',
      borderClass: 'border-rose-200',
      textClass: 'text-rose-700',
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
      colorHex: '#F59E0B',
      bgClass: 'bg-amber-50 hover:bg-amber-100',
      borderClass: 'border-amber-200',
      textClass: 'text-amber-700',
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
    <div className={`bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm ${className}`}>
      {/* Header with Info and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-canvas-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary-light border border-primary-border text-primary shrink-0">
            <Pill className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-body-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
              Medication Overlay Bands
              <span className="text-caption px-1.5 py-0.5 rounded-full bg-primary-light text-primary-text font-semibold border border-primary-border">
                Timeline Aligned
              </span>
            </h4>
            <p className="text-caption text-muted leading-relaxed">
              Active & historical drug courses overlaid on the biomarker timeline to visualize causal impacts.
            </p>
          </div>
        </div>

        {/* Legend / Toggles with >=44px Touch Targets */}
        <div className="flex items-center gap-2 flex-wrap">
          {defaultTimelineMeds.map((med) => {
            const isVis = visibleMeds[med.id] !== false;
            return (
              <button
                key={med.id}
                type="button"
                onClick={() => toggleMed(med.id)}
                className={`text-caption px-3 py-2 rounded-full font-bold flex items-center gap-2 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] touch-manipulation ${
                  isVis
                    ? `${med.bgClass} ${med.borderClass} ${med.textClass} shadow-sm`
                    : 'bg-canvas-card text-muted border-canvas-border opacity-60'
                }`}
                title={`Toggle ${med.name}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isVis ? med.colorHex : '#64748B' }}
                />
                <span>{med.name}</span>
                {isVis ? <Eye className="w-3.5 h-3.5 opacity-70 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 opacity-70 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline Visualization Bands Container */}
      <div className="relative pt-1 pb-2 space-y-1.5">
        {/* Subtle grid ticks matching chart width */}
        <div className="absolute inset-0 pointer-events-none flex justify-between">
          <div className="w-px h-full bg-canvas-border/60" />
          <div className="w-px h-full bg-canvas-border/60" />
          <div className="w-px h-full bg-canvas-border/60" />
          <div className="w-px h-full bg-canvas-border/60" />
          <div className="w-px h-full bg-canvas-border/60" />
        </div>

        {defaultTimelineMeds
          .filter((m) => visibleMeds[m.id] !== false)
          .map((med) => {
            const leftPct = getPositionPercent(med.startDate);
            const widthPct = getWidthPercent(med.startDate, med.stopDate);
            // Clamp left position so that a 64px min-width band never clips or overflows the container on narrow screens
            const clampedLeft = Math.min(leftPct, 84);
            const isSelected = selectedMed?.id === med.id;

            return (
              <div key={med.id} className="relative h-8 w-full flex items-center">
                {/* Horizontal Band with minimum width and non-collapsing drug label */}
                <button
                  type="button"
                  onClick={() => setSelectedMed(selectedMed?.id === med.id ? null : med)}
                  style={{
                    left: `${clampedLeft}%`,
                    width: `${Math.max(widthPct, 12)}%`,
                    minWidth: '64px',
                    maxWidth: `calc(100% - ${clampedLeft}%)`
                  }}
                  className={`absolute h-7 rounded-lg px-2 flex items-center justify-between text-left text-caption font-semibold transition-all border shadow-sm cursor-pointer z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${med.bgClass} ${med.borderClass} ${med.textClass} ${
                    isSelected ? 'ring-2 ring-primary/40 scale-[1.01]' : ''
                  }`}
                  aria-label={`${med.name} ${med.dosage} (${med.status})`}
                >
                  <span className="truncate flex items-center gap-1.5 min-w-0 mr-1">
                    {med.category === 'nsaid' && <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />}
                    <span className="font-bold truncate">{med.name}</span>
                    <span className="opacity-80 text-[10px] hidden md:inline font-normal shrink-0">({med.dosage})</span>
                  </span>

                  <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-black/20 shrink-0 uppercase">
                    {med.status}
                  </span>
                </button>
              </div>
            );
          })}
      </div>

      {/* Selected Medication Details Card */}
      {selectedMed && (
        <div className="mt-3 p-3.5 sm:p-4 bg-canvas-muted border border-canvas-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in text-body-sm shadow-sm">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-body-sm">{selectedMed.name}</span>
              <span className={`text-caption px-2 py-0.5 rounded-full font-bold border ${selectedMed.bgClass} ${selectedMed.borderClass} ${selectedMed.textClass}`}>
                {selectedMed.dosage}
              </span>
              <span className="text-caption text-muted">
                {new Date(selectedMed.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                {selectedMed.stopDate ? ` → ${new Date(selectedMed.stopDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' → Ongoing'}
              </span>
            </div>

            <p className="text-slate-700 font-medium leading-relaxed">{selectedMed.notes}</p>
            <div className="flex items-center gap-3 text-caption text-muted pt-1 flex-wrap">
              <span>Indication: <strong className="text-slate-900">{selectedMed.indication}</strong></span>
              <span>•</span>
              <span>Prescriber: <strong className="text-slate-900">{(selectedMed.prescribedBy || '').trim() || 'Your doctor'}</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedMed(null)}
            className="text-muted hover:text-slate-900 text-caption px-3.5 py-2 bg-canvas-card rounded-xl hover:bg-white border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold self-end sm:self-center"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
