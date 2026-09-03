import React, { useState, useEffect } from 'react';
import {
  Activity,
  UploadCloud,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { IndicatorTable } from './IndicatorTable';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import { ModalPortal } from '../common/ModalPortal';
import { resolvePatientId } from '@/components/common/resolvePatientId';
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
  onBusyChange?: (busy: boolean) => void;
}

export const LabStoryView: React.FC<LabStoryViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' },
  className = '',
  onBusyChange,
}) => {
  const effectivePatientId = resolvePatientId(patientId, activeProfile?.userId);
  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [isDropzoneOpen, setIsDropzoneOpen] = useState<boolean>(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Manual Lab Entry Form State
  const [manualMarker, setManualMarker] = useState('Creatinine');
  const [manualValue, setManualValue] = useState('1.85');
  const [manualUnit, setManualUnit] = useState('mg/dL');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

  const loadLabs = () => {
    const patientLabs = effectivePatientId ? localVault.getLabs(effectivePatientId) : [];
    setLabs(patientLabs);
  };

  useEffect(() => {
    loadLabs();

    const guard = (p: unknown) => {
      const pid = (p as { patientId?: string })?.patientId;
      return !p || !pid || pid === effectivePatientId;
    };
    const onLabAdded = (payload: unknown) => { if (guard(payload)) loadLabs(); };
    const onFactConfirmed = (payload: unknown) => {
      const rec = payload as { patientId?: string; fact?: { patientId?: string } };
      const pid = rec?.patientId || rec?.fact?.patientId;
      if (!pid || pid === effectivePatientId) loadLabs();
    };

    const u1 = eventBus.on('lab_added', onLabAdded as (p: unknown) => void);
    const u2 = eventBus.on('fact_confirmed', onFactConfirmed as (p: unknown) => void);
    const u3 = eventBus.on('lab_status_changed', onLabAdded as (p: unknown) => void);
    const u4 = eventBus.on('vault_synced' as unknown as string, loadLabs as unknown as () => void);

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [effectivePatientId]);

  const handleIngestDataset = async (type: 'shanti' | 'jenkins' | 'custom') => {
    setIsLoading(true);
    try {
      const docId = type === 'jenkins' ? 'doc_jenkins_5y_labs' : 'doc_historical_labs_2022_2026';
      const context = {
        patientId: effectivePatientId,
        activeProfile: {
          userId: activeProfile.userId,
          name: activeProfile.name,
          role: (activeProfile.role === 'caregiver' || activeProfile.role === 'doctor' ? activeProfile.role : 'patient') as 'patient' | 'caregiver' | 'doctor',
          isProxy: Boolean(activeProfile.isProxy)
        },
        vault: localVault,
        eventBus
      };

      await webMCPEngine.execute('extract_labs', { documentId: docId, patientId: effectivePatientId }, context as unknown as Record<string, unknown>);
      loadLabs();
      setIsDropzoneOpen(false);
    } catch {
      // extract_labs failure handled via toast in engine
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualValue);
    if (isNaN(val)) return;

    const newRecord = {
      id: `lab_${effectivePatientId}_${manualMarker.toLowerCase()}_${Date.now()}`,
      patientId: effectivePatientId,
      marker: manualMarker,
      value: val,
      unit: manualUnit,
      normalizedValue: val,
      normalizedUnit: manualUnit,
      drawDate: new Date(manualDate).toISOString(),
      referenceRange: undefined,
      optimalRange: undefined,
      isBorderline: false,
      isCritical: false,
      flag: undefined,
    } as unknown as LabRecord;

    try {
      await localVault.addLab(newRecord, {
        userId: activeProfile.userId,
        userName: activeProfile.name,
        role: activeProfile.role as 'patient' | 'caregiver' | 'doctor'
      });
    } catch (err: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Save failed', message: err instanceof Error ? err.message : 'Server save failed. Please retry.' });
      return;
    }

    loadLabs();
    setIsManualAddOpen(false);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Lab Result Added',
      message: `${manualMarker} (${val} ${manualUnit}) recorded.`
    });
  };

  return (
    <div className={`space-y-4 max-w-7xl mx-auto animate-fade-in ${className}`}>
      {/* Top Header & Quick Actions */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-heading-lg text-slate-900">Lab Results</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border">
                {labs.length} {labs.length === 1 ? 'result' : 'results'}
              </span>
            </div>
            <p className="text-body-sm text-muted leading-relaxed">
              Your blood tests at a glance — tap any row for history, trend, and your doctor's note.
            </p>
          </div>
        </div>

        {/* Header Action Buttons with >=44px Touch Targets */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDropzoneOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex-1 sm:flex-initial"
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span>Add Past Results</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManualAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-bg text-slate-900 text-body-sm font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4 text-primary shrink-0" />
            <span>Add Manually</span>
          </button>
        </div>
      </div>

      {/* Indicators table — the page. Grouped by what the markers check; each row opens details. */}
      {labs.length > 0 && <IndicatorTable labs={labs} />}

      {/* Friendly empty hint pointing at the actions above */}
      {labs.length === 0 ? (
        <div className="bg-canvas-card border border-dashed border-canvas-border rounded-2xl p-6 sm:p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-heading-md text-slate-900">No lab results yet</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto leading-relaxed">Add results manually or from past reports — they fill your other sections too.</p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button type="button" onClick={() => setIsDropzoneOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center">Add Past Results</button>
            <button type="button" onClick={() => setIsManualAddOpen(true)} className="px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-bg border border-canvas-border text-slate-900 text-body-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center">Add Manually</button>
          </div>
        </div>
      ) : null}

      {/* Modal: Multi-Doc Timeline Ingestion */}
      <ModalPortal isOpen={isDropzoneOpen} onClose={() => setIsDropzoneOpen(false)} ariaLabel="Add Past Results">
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto mx-auto">
          <div className="flex items-center justify-between border-b border-canvas-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-heading-md">
              <UploadCloud className="w-5 h-5" />
              <span>Add Past Results</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDropzoneOpen(false)}
              className="text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="text-body-sm text-muted leading-relaxed">
            Upload lab PDF packets or photos of result slips — we read them, standardize the units, and add them to your table. You can also load a sample history to try it out.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleIngestDataset('shanti')}
              disabled={isLoading}
              className="w-full text-left p-3.5 rounded-xl bg-canvas-muted hover:bg-canvas-bg border border-canvas-border transition-colors flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px]"
            >
              <div>
                <div className="text-body-sm font-bold text-slate-900">
                  Longitudinal History (2022–2026)
                </div>
                <div className="text-caption text-muted leading-relaxed">
                  Sample dataset — kidney, blood sugar, and cholesterol markers over five years.
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleIngestDataset('jenkins')}
              disabled={isLoading}
              className="w-full text-left p-3.5 rounded-xl bg-canvas-muted hover:bg-canvas-bg border border-canvas-border transition-colors flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px]"
            >
              <div>
                <div className="text-body-sm font-bold text-slate-900">
                  Renal &amp; Diabetes Panel
                </div>
                <div className="text-caption text-muted leading-relaxed">
                  Sample dataset — acute kidney drop after a hospital stay, plus diabetes markers.
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </button>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-body-sm text-primary font-medium py-1">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> Reading & adding results…
            </div>
          )}

          <div className="border-t border-canvas-border pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDropzoneOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-bg text-slate-700 font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] text-body-sm flex items-center justify-center"
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalPortal>

      {/* Modal: Manual Lab Data Entry */}
      <ModalPortal isOpen={isManualAddOpen} onClose={() => setIsManualAddOpen(false)} ariaLabel="Add Lab Result Manually">
        <form
          onSubmit={handleManualAddSubmit}
          className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-body-sm max-h-[90vh] overflow-y-auto mx-auto"
        >
          <div className="flex items-center justify-between border-b border-canvas-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-heading-md">
              <Plus className="w-4 h-4" />
              <span>Add Lab Result Manually</span>
            </div>
            <button
              type="button"
              onClick={() => setIsManualAddOpen(false)}
              className="text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="manual-marker" className="block text-muted mb-1 font-semibold text-caption">Biomarker</label>
              <select
                id="manual-marker"
                value={manualMarker}
                onChange={(e) => setManualMarker(e.target.value)}
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="manual-value" className="block text-muted mb-1 font-semibold text-caption">Value</label>
                <input
                  id="manual-value"
                  type="number"
                  step="any"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  required
                  className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="manual-unit" className="block text-muted mb-1 font-semibold text-caption">Units</label>
                <input
                  id="manual-unit"
                  type="text"
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value)}
                  required
                  className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="manual-date" className="block text-muted mb-1 font-semibold text-caption">Test Date</label>
              <input
                id="manual-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              />
            </div>
          </div>

          <div className="border-t border-canvas-border pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsManualAddOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-bg text-slate-700 font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center"
            >
              Add to Table
            </button>
          </div>
        </form>
      </ModalPortal>
    </div>
  );
};
