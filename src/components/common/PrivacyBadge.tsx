import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Download, Database } from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export const PrivacyBadge: React.FC<{ patientId?: string }> = ({ patientId = '' }) => {
  const [stats, setStats] = useState({ facts: 0, meds: 0, labs: 0 });
  const [showModal, setShowModal] = useState(false);

  const refreshStats = async () => {
    const [facts, meds, labs] = await Promise.all([
      localVault.getConfirmedFacts(patientId),
      localVault.getActiveMedications(patientId),
      localVault.getLabs(patientId),
    ]);
    setStats({ facts: facts.length, meds: meds.length, labs: labs.length });
  };

  useEffect(() => {
    refreshStats();
    const u1 = eventBus.on('fact_confirmed', refreshStats);
    const u2 = eventBus.on('medication_added', refreshStats);
    const u3 = eventBus.on('medication_updated', refreshStats);
    const u4 = eventBus.on('lab_added', refreshStats);
    const u5 = eventBus.on('lab_extracted', refreshStats);
    const u6 = eventBus.on('fact_added', refreshStats);
    const u7 = eventBus.on('fact_status_changed', refreshStats);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, [patientId]);

  // ESC closes modal + focus trap handled by global *:focus-visible
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const handleExportFHIR = async () => {
    const facts = await localVault.getConfirmedFacts(patientId);
    const meds = await localVault.getActiveMedications(patientId);
    const labs = await localVault.getLabs(patientId);

    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        ...facts.map((f) => ({ resource: { resourceType: 'Observation', code: f.factKey, value: f.factValue } })),
        ...meds.map((m) => ({ resource: { resourceType: 'MedicationStatement', status: 'active', medication: m.name } })),
        ...labs.map((l) => ({ resource: { resourceType: 'Observation', code: l.markerCode, value: l.value, unit: l.unit } })),
      ],
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Healthbook_FHIR_Export_${patientId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    eventBus.dispatchToast({
      type: 'success',
      title: 'Export Complete',
      message: 'Exported local health record as FHIR R4 Bundle JSON.',
    });
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all text-xs font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        title="Click to view local privacy guarantees and vault stats"
        aria-label="View privacy guarantees and vault stats"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span className="font-semibold tracking-wide">Local data</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Local data storage"
        >
          <div
            className="bg-white border border-canvas-border rounded-2xl max-w-lg w-full p-3 sm:p-6 shadow-2xl space-y-5 text-slate-800 max-h-[90vh] overflow-y-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-200 rounded-xl text-emerald-600 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-heading-md text-slate-900">Local data</h3>
                  <p className="text-caption text-muted font-medium">Privacy Guarantee for The WebMCP Challenge</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-slate-800 p-2 rounded-xl hover:bg-canvas-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                aria-label="Close privacy details"
              >
                ✕
              </button>
            </div>

            <div className="bg-canvas-muted p-4 rounded-xl border border-canvas-border space-y-2 text-xs text-slate-700 leading-relaxed">
              <p className="flex items-center gap-2 text-emerald-600 font-semibold">
                <Lock className="w-4 h-4" /> Local data
              </p>
              <p>Data stays on this device.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-canvas-muted rounded-xl border border-canvas-border text-center shadow-sm">
                <div className="text-2xl font-bold text-sky-600">{stats.facts}</div>
                <div className="text-caption text-muted uppercase tracking-wider mt-0.5">Approved Facts</div>
              </div>
              <div className="p-3 bg-canvas-muted rounded-xl border border-canvas-border text-center shadow-sm">
                <div className="text-2xl font-bold text-emerald-600">{stats.meds}</div>
                <div className="text-caption text-muted uppercase tracking-wider mt-0.5">Active Meds</div>
              </div>
              <div className="p-3 bg-canvas-muted rounded-xl border border-canvas-border text-center shadow-sm">
                <div className="text-2xl font-bold text-purple-600">{stats.labs}</div>
                <div className="text-caption text-muted uppercase tracking-wider mt-0.5">Tracked Labs</div>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-canvas-border">
              <div className="text-xs text-muted flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-muted shrink-0" />
                <span>Store: Supabase (server truth, RLS-isolated)</span>
              </div>
              <button
                onClick={handleExportFHIR}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors min-h-[44px]"
                aria-label="Export FHIR R4 Bundle"
              >
                <Download className="w-3.5 h-3.5" />
                Export FHIR R4 Bundle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
