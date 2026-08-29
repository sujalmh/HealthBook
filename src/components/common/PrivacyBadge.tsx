import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Download, Database } from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export const PrivacyBadge: React.FC<{ patientId?: string }> = ({ patientId = 'patient-s-devi' }) => {
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
    a.download = `CareCanvas_FHIR_Export_${patientId}_${Date.now()}.json`;
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 hover:bg-emerald-900/60 transition-all text-xs font-medium shadow-sm hover:shadow-emerald-950/50"
        title="Click to view local privacy guarantees and vault stats"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Lock className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold tracking-wide">Local Vault (Zero Cloud PHI)</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-800">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-200 rounded-xl text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Zero-Cloud PHI Invariant</h3>
                  <p className="text-xs text-slate-600">Privacy Guarantee for The WebMCP Challenge</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-600 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700 leading-relaxed">
              <p className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Lock className="w-4 h-4" /> 100% Client-Side In-Browser Execution
              </p>
              <p>
                All medical parsing, OCR extraction, drug-drug interaction calculations, causal biomarker graphs, and schedule
                optimizations run exclusively on your device within IndexedDB and in-browser WebMCP models.
              </p>
              <p className="text-slate-600">
                Protected Health Information (PHI) is never sent to third-party telemetry servers or cloud databases.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/60 text-center">
                <div className="text-2xl font-bold text-sky-400">{stats.facts}</div>
                <div className="text-[11px] text-slate-600 uppercase tracking-wider mt-0.5">Approved Facts</div>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/60 text-center">
                <div className="text-2xl font-bold text-emerald-400">{stats.meds}</div>
                <div className="text-[11px] text-slate-600 uppercase tracking-wider mt-0.5">Active Meds</div>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/60 text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.labs}</div>
                <div className="text-[11px] text-slate-600 uppercase tracking-wider mt-0.5">Tracked Labs</div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-200">
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-slate-600" />
                <span>Store: IndexedDB (LocalVault v1)</span>
              </div>
              <button
                onClick={handleExportFHIR}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
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
