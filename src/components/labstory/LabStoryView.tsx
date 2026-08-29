import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  UploadCloud,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  Plus,
  RefreshCw,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Pin,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  Database
} from 'lucide-react';
import { BiomarkerChart, ZoomWindow } from './BiomarkerChart';
import { MedOverlayBands } from './MedOverlayBands';
import { CausalQueryPanel } from './CausalQueryPanel';
import { StorySentence } from './StorySentence';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import type { LabRecord } from '@/types/vault';

interface LabStoryViewProps {
  patientId: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
  };
  className?: string;
}

export const LabStoryView: React.FC<LabStoryViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' },
  className = ''
}) => {
  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<string>('eGFR');
  const [activeZoom, setActiveZoom] = useState<ZoomWindow>('5Y');
  const [showReferenceRange, setShowReferenceRange] = useState<boolean>(true);
  const [showOptimalRange, setShowOptimalRange] = useState<boolean>(true);
  const [isDropzoneOpen, setIsDropzoneOpen] = useState<boolean>(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [causalWindow, setCausalWindow] = useState<{ start: string; end: string; label?: string } | null>(null);

  // Manual Lab Entry Form State
  const [manualMarker, setManualMarker] = useState('Creatinine');
  const [manualValue, setManualValue] = useState('1.85');
  const [manualUnit, setManualUnit] = useState('mg/dL');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

  // Load labs from LocalVault for active patient — read-only, no per-view seeding (centralized seed.ts via main.tsx owns baseline).
  const loadLabs = () => {
    const patientLabs = localVault.getLabs(patientId);
    setLabs(patientLabs);
  };

  // M2 Relevant-only: LabStory listens to lab_added (alias lab_extracted), fact_confirmed (alias fact_status_changed/fact_added), medication_updated (overlay)
  // Does NOT subscribe to danger_report, calendar, due_card, proposal_* — spurious guard.
  // Alias dispatch ensures legacy emits (lab_extracted, fact_status_changed) still trigger canonical listeners without double subscription.
  useEffect(() => {
    loadLabs();

    const guard = (p: any) => !p || !p.patientId || p.patientId === patientId;
    const onLabAdded = (payload: any) => { if (guard(payload)) loadLabs(); };
    const onFactConfirmed = (payload: any) => {
      const pid = payload?.patientId || payload?.fact?.patientId;
      if (!pid || pid === patientId) loadLabs();
    };
    const onMedOverlay = (payload: any) => { if (guard(payload)) loadLabs(); };

    const u1 = eventBus.on('lab_added', onLabAdded);
    const u2 = eventBus.on('fact_confirmed', onFactConfirmed);
    const u3 = eventBus.on('medication_updated', onMedOverlay);
    // alias for legacy lab_status_changed used by DoctorInbox — distinct, not in main alias group
    const u4 = eventBus.on('lab_status_changed', onLabAdded);

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [patientId]);

  // Distinct markers available in patient labs
  const availableMarkers = useMemo(() => {
    const defaultOrder = ['eGFR', 'Creatinine', 'HbA1c', 'Glucose Fasting', 'Potassium', 'Cholesterol Total', 'LDL', 'HDL', 'Triglycerides'];
    const discovered = Array.from(new Set(labs.map((l) => l.marker)));
    const all = Array.from(new Set([...defaultOrder, ...discovered]));
    return all.map((marker) => {
      const markerLabs = labs.filter((l) => l.marker.toLowerCase() === marker.toLowerCase());
      const sorted = [...markerLabs].sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());
      const latest = sorted[sorted.length - 1];
      return {
        marker,
        count: markerLabs.length,
        latestValue: latest ? latest.normalizedValue : null,
        unit: latest ? latest.normalizedUnit : '',
        flag: latest?.flag || (latest?.isBorderline ? 'BORDERLINE' : 'NORMAL'),
        isCritical: latest?.isCritical || false
      };
    });
  }, [labs]);

  // Active Marker Labs series
  const activeMarkerLabs = useMemo(() => {
    return labs.filter((l) => l.marker.toLowerCase() === selectedMarker.toLowerCase());
  }, [labs, selectedMarker]);

  // Overall timeline min and max timestamp
  const { minEpoch, maxEpoch } = useMemo(() => {
    if (labs.length === 0) {
      const now = Date.now();
      return { minEpoch: now - 365 * 24 * 3600 * 1000, maxEpoch: now };
    }
    const times = labs.map((l) => new Date(l.drawDate).getTime());
    return { minEpoch: Math.min(...times), maxEpoch: Math.max(...times) };
  }, [labs]);

  // Ingest Multi-Doc Drop via WebMCP extract_labs tool
  const handleIngestDataset = async (type: 'shanti' | 'jenkins' | 'custom') => {
    setIsLoading(true);
    try {
      const docId = type === 'jenkins' ? 'doc_jenkins_5y_labs' : 'doc_historical_labs_2022_2026';
      const context = {
        patientId,
        activeProfile: {
          userId: activeProfile.userId,
          name: activeProfile.name,
          role: (activeProfile.role === 'caregiver' || activeProfile.role === 'doctor' ? activeProfile.role : 'patient') as 'patient' | 'caregiver' | 'doctor',
          isProxy: Boolean(activeProfile.isProxy)
        },
        vault: localVault,
        eventBus
      };

      await webMCPEngine.execute('extract_labs', { documentId: docId, patientId }, context);
      loadLabs();
      setIsDropzoneOpen(false);
    } catch (err: any) {
      console.error('[LabStoryView] Error in extract_labs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add Doctor Comment to Lab
  const handleAddDoctorComment = (labId: string, commentText: string) => {
    const updated = localVault.addDoctorCommentToLab(labId, {
      doctorId: activeProfile.userId,
      doctorName: activeProfile.role === 'doctor' ? activeProfile.name : 'Dr. Anita Patel, MD',
      comment: commentText
    });

    if (updated) {
      loadLabs();
      eventBus.dispatchToast({
        type: 'success',
        title: 'Clinician Comment Pinned (📌)',
        message: 'Comment anchored to data point and updated on LabStory canvas.'
      });
    }
  };

  // Submit Manual Lab Entry
  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualValue);
    if (isNaN(val)) return;

    const newRecord: LabRecord = {
      id: `lab_${patientId}_${manualMarker.toLowerCase()}_${Date.now()}`,
      patientId,
      marker: manualMarker,
      value: val,
      unit: manualUnit,
      normalizedValue: val,
      normalizedUnit: manualUnit,
      drawDate: new Date(manualDate).toISOString(),
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: false,
      isCritical: false,
      flag: 'NORMAL'
    };

    localVault.addLab(newRecord, {
      userId: activeProfile.userId,
      userName: activeProfile.name,
      role: activeProfile.role as any
    });

    loadLabs();
    setIsManualAddOpen(false);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Lab Result Added',
      message: `${manualMarker} (${val} ${manualUnit}) recorded.`
    });
  };

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${className}`}>
      {/* Top Header & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Lab Results</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-700 font-bold border border-sky-200">
                Trends over time
              </span>
            </div>
            <p className="text-xs text-slate-600">
              See your blood tests over time — what’s normal, what’s changed, and how your medicines affect them.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsDropzoneOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Add Past Results</span>
          </button>

          <button
            onClick={() => setIsManualAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Add Result Manually</span>
          </button>

          <button
            onClick={loadLabs}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 transition-colors"
            title="Refresh Timeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Biomarker Selector Scrollbar / Pills */}
      <div className="bg-white/90 border border-slate-200 rounded-2xl p-2.5 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {availableMarkers.map((m) => {
            const isSelected = selectedMarker.toLowerCase() === m.marker.toLowerCase();
            return (
              <button
                key={m.marker}
                onClick={() => {
                  setSelectedMarker(m.marker);
                  setCausalWindow(null);
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-700 border-sky-500/50 shadow-sm'
                    : 'bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    m.isCritical
                      ? 'bg-rose-500 shadow-sm shadow-rose-500'
                      : m.flag === 'BORDERLINE'
                      ? 'bg-amber-500'
                      : m.flag === 'HIGH' || m.flag === 'LOW'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span>{m.marker}</span>
                {m.latestValue !== null && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-slate-700">
                    {m.latestValue} {m.unit}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Friendly empty when no labs yet */}
      {labs.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No lab results yet</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">Upload past results or add one manually — your chart will appear here and update your other sections automatically.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setIsDropzoneOpen(true)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold">Add Past Results</button>
            <button onClick={() => setIsManualAddOpen(true)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold">Add Manually</button>
          </div>
        </div>
      ) : null}

      {/* Story Sentence Longitudinal Trajectory Narrative (LS6) */}
      {labs.length > 0 && <StorySentence marker={selectedMarker} labs={activeMarkerLabs} />}

      {/* Main Interactive Visual Canvas: Biomarker Chart (LS2, LS5, LS8) */}
      {labs.length > 0 && (
        <BiomarkerChart
          markerName={selectedMarker}
          labs={activeMarkerLabs}
          activeZoom={activeZoom}
          onZoomChange={setActiveZoom}
          showReferenceRange={showReferenceRange}
          showOptimalRange={showOptimalRange}
          onToggleReferenceRange={setShowReferenceRange}
          onToggleOptimalRange={setShowOptimalRange}
          onAddDoctorComment={handleAddDoctorComment}
          causalHighlightWindow={causalWindow}
        />
      )}

      {/* Medication Timeline Overlay Bands (LS4) */}
      {labs.length > 0 && <MedOverlayBands minTime={minEpoch} maxTime={maxEpoch} />}

      {/* "Ask Why" Conversational Causal Engine Panel (LS3, LS7) */}
      {labs.length > 0 && (
        <CausalQueryPanel
          patientId={patientId}
          activeMarker={selectedMarker}
          onHighlightCausalWindow={setCausalWindow}
        />
      )}

      {/* Tabular Longitudinal Results History */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900">
              Longitudinal Lab History: {selectedMarker} ({activeMarkerLabs.length} records)
            </h3>
          </div>
          <span className="text-[11px] text-slate-600">
            Stored locally in IndexedDB LocalVault (100% Private)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 font-semibold">Draw Date</th>
                <th className="py-2.5 px-3 font-semibold">Measured Value</th>
                <th className="py-2.5 px-3 font-semibold">Normalized Value</th>
                <th className="py-2.5 px-3 font-semibold">Reference Range</th>
                <th className="py-2.5 px-3 font-semibold">Status Tag</th>
                <th className="py-2.5 px-3 font-semibold">Doctor Pinned Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-700 font-medium">
              {[...activeMarkerLabs]
                .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime())
                .map((r) => {
                  const docComment = r.doctorComment || r.doctorComments?.[0];
                  return (
                    <tr key={r.id} className="hover:bg-slate-100/30 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-800">
                        {new Date(r.drawDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {r.value} {r.unit}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {r.normalizedValue} {r.normalizedUnit}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {r.referenceRange.low} – {r.referenceRange.high} {r.normalizedUnit}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            r.isCritical
                              ? 'bg-rose-500/20 text-rose-700 border border-rose-200'
                              : r.isBorderline
                              ? 'bg-amber-500/20 text-amber-700 border border-amber-200'
                              : 'bg-emerald-500/20 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {r.flag || (r.isBorderline ? 'BORDERLINE' : 'NORMAL')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {docComment ? (
                          <span className="flex items-center gap-1 text-amber-400 text-[11px] font-semibold">
                            <Pin className="w-3 h-3" />
                            <span>{docComment.doctorName}: {docComment.comment.substring(0, 35)}...</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Multi-Doc Timeline Ingestion (LS1) */}
      {isDropzoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-base">
                <UploadCloud className="w-5 h-5" />
                <span>Multi-Year Lab Drop & Ingestion (LS1)</span>
              </div>
              <button
                onClick={() => setIsDropzoneOpen(false)}
                className="text-slate-600 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Upload multi-year laboratory PDF packets, smartphone photo result slips, or select a pre-verified longitudinal cohort to auto-normalize units and place points on the timeline.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => handleIngestDataset('shanti')}
                disabled={isLoading}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-sky-500/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-sky-700">
                    Shanti Devi 5-Year Longitudinal History (2022–2026)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Includes CKD 3b, Metformin initiation, Prednisone burst spike, and Atorvastatin titration.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400" />
              </button>

              <button
                onClick={() => handleIngestDataset('jenkins')}
                disabled={isLoading}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-sky-500/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-sky-700">
                    Harold Jenkins Renal AKI & Diabetes Panel
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Features acute eGFR decline to 28 mL/min post-discharge and Ketorolac gout course.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400" />
              </button>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsDropzoneOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Lab Data Entry */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleManualAddSubmit}
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Plus className="w-4 h-4" />
                <span>Add Lab Result Point</span>
              </div>
              <button
                type="button"
                onClick={() => setIsManualAddOpen(false)}
                className="text-slate-600 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Biomarker Name</label>
                <select
                  value={manualMarker}
                  onChange={(e) => setManualMarker(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                >
                  <option value="Creatinine">Creatinine (mg/dL)</option>
                  <option value="eGFR">eGFR (mL/min/1.73m2)</option>
                  <option value="HbA1c">HbA1c (%)</option>
                  <option value="Glucose Fasting">Glucose Fasting (mg/dL)</option>
                  <option value="Potassium">Potassium (mEq/L)</option>
                  <option value="Cholesterol Total">Cholesterol Total (mg/dL)</option>
                  <option value="LDL">LDL (mg/dL)</option>
                  <option value="HDL">HDL (mg/dL)</option>
                  <option value="Triglycerides">Triglycerides (mg/dL)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Numeric Value</label>
                  <input
                    type="number"
                    step="any"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Units</label>
                  <input
                    type="text"
                    value={manualUnit}
                    onChange={(e) => setManualUnit(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Draw Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsManualAddOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors"
              >
                Add to Timeline
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
