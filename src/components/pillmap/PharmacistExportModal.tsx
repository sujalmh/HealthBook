/**
 * CareCanvas Component: PharmacistExportModal
 * 1-Page visual schedule and clinical crosswalk export bundle for pharmacist review.
 */

import React, { useState } from 'react';
import { Printer, Copy, Check, X, FileText, ShieldAlert, CheckCircle2, Award } from 'lucide-react';
import type { PharmacistExportBundle, PillboxGrid } from '../../types/pillmap.ts';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../../types/pillmap.ts';

export interface PharmacistExportModalProps {
  bundle: PharmacistExportBundle;
  onClose: () => void;
}

export const PharmacistExportModal: React.FC<PharmacistExportModalProps> = ({
  bundle,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-lg overflow-hidden animate-scale-up">
        {/* Modal Top Control Bar */}
        <div className="p-3.5 sm:p-4 bg-canvas-muted border-b border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-body font-bold text-slate-900 tracking-tight">
              1-Page Pharmacist Consultation & Regimen Map
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
            <button
              onClick={handleCopyJSON}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors min-h-[44px]"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold transition-colors shadow-sm min-h-[44px]"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              aria-label="Close export modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-canvas-muted text-slate-900 space-y-6 print:bg-white print:text-black">
          {/* Document Header */}
          <div className="border-b border-canvas-border pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-heading-md sm:text-heading-lg tracking-tight text-slate-900 print:text-black font-bold">
                  CareCanvas — Clinical Pharmacist Regimen Map
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary-text text-caption font-semibold border border-primary-border print:hidden">
                  Verified LocalVault Snapshot
                </span>
              </div>
              <p className="text-body-sm text-muted print:text-gray-600 mt-1">
                Patient: <strong className="text-slate-900 print:text-black">{bundle.patientName}</strong> | Generated: {new Date(bundle.generatedDate).toLocaleDateString()}
              </p>
            </div>
            <div className="text-left sm:text-right text-body-sm text-muted print:text-gray-600">
              <span className="font-semibold text-primary-text print:text-black block">Privacy-Preserving On-Device Vault</span>
              <span>Zero PHI Cloud Transmission</span>
            </div>
          </div>

          {/* Section 1: Brand / Generic Crosswalk Table */}
          <div className="space-y-2">
            <h3 className="text-caption uppercase tracking-wider text-primary-text print:text-gray-800 font-bold">
              1. Active Medication Regimen & Crosswalk
            </h3>
            <div className="border border-canvas-border rounded-xl overflow-x-auto print:border-gray-300 bg-white" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-body-sm text-left min-w-[550px]">
                <thead className="bg-canvas-muted border-b border-canvas-border text-muted font-semibold uppercase text-caption print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-2.5">Brand Name</th>
                    <th className="p-2.5">Generic Chemical</th>
                    <th className="p-2.5">Therapeutic Class</th>
                    <th className="p-2.5">Strength / Dose</th>
                    <th className="p-2.5">Frequency / Timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-border print:divide-gray-200">
                  {bundle.brandGenericCrosswalk.map((item, idx) => (
                    <tr key={idx} className="hover:bg-canvas-muted print:hover:bg-transparent">
                      <td className="p-2.5 font-semibold text-slate-900 print:text-black">{item.brand}</td>
                      <td className="p-2.5 text-slate-700 print:text-gray-800">{item.generic}</td>
                      <td className="p-2.5 text-muted print:text-gray-600">{item.class || 'Prescription Drug'}</td>
                      <td className="p-2.5 font-mono font-semibold text-emerald-700 print:text-black">{item.dose}</td>
                      <td className="p-2.5 text-slate-700 print:text-gray-800">{item.frequency || item.timingSlots?.join(', ') || 'Scheduled Daily'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Clinical Interactions & Diet Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Drug-Drug Conflicts */}
            <div className="space-y-2">
              <h3 className="text-caption uppercase tracking-wider text-rose-600 print:text-gray-800">
                2. Flagged Drug Interactions ({bundle.drugInteractions.length})
              </h3>
              <div className="space-y-2">
                {bundle.drugInteractions.length === 0 ? (
                  <p className="text-body-sm text-muted italic">No drug-drug interaction conflicts flagged.</p>
                ) : (
                  bundle.drugInteractions.map((arc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-canvas-border text-body-sm space-y-1 print:bg-gray-50 print:border-gray-300"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-900 print:text-black">{arc.drugA} + {arc.drugB}</span>
                        <span
                          className={`text-caption px-1.5 py-0.5 rounded font-bold uppercase ${
                            arc.severity === 'CONTRAINDICATED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {arc.severity}
                        </span>
                      </div>
                      <p className="text-slate-700 text-body-sm print:text-gray-700">{arc.mechanism}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Diet & Meal Rules */}
            <div className="space-y-2">
              <h3 className="text-caption uppercase tracking-wider text-amber-700 print:text-gray-800">
                3. Dietary & Timing Rules ({bundle.dietTimingRules.length})
              </h3>
              <div className="space-y-2">
                {bundle.dietTimingRules.length === 0 ? (
                  <p className="text-body-sm text-muted italic">No specific food-drug restrictions noted.</p>
                ) : (
                  bundle.dietTimingRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-canvas-border text-body-sm space-y-1 print:bg-gray-50 print:border-gray-300"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-900 print:text-black">{rule.drugName}</span>
                        <span className="text-caption text-amber-700 font-semibold">{rule.badgeText}</span>
                      </div>
                      <p className="text-slate-700 text-body-sm print:text-gray-700">{rule.clinicalGuidance}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Pharmacist Sign-Off & Verification Block */}
          <div className="p-4 rounded-2xl bg-white border border-canvas-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:bg-gray-50 print:border-gray-300">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold text-body-sm text-slate-900 print:text-black">
                  Clinical Pharmacist Verification Block
                </h4>
                <p className="text-caption text-muted print:text-gray-600">
                  Reviewed for drug interactions, therapeutic duplication, and renal dosage adjustment.
                </p>
              </div>
            </div>
            <div className="text-right border-t sm:border-t-0 sm:border-l border-canvas-border pl-0 sm:pl-4 pt-2 sm:pt-0 w-full sm:w-auto">
              <div className="text-body-sm font-mono text-slate-700 print:text-black">
                Signature: ______________________
              </div>
              <div className="text-caption text-muted mt-1">
                Date: {new Date().toLocaleDateString()} | License / NPI: _________
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
