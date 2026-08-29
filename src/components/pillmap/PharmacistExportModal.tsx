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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Modal Top Control Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              1-Page Pharmacist Consultation & Regimen Map
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              aria-label="Close export modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-slate-900 space-y-6 print:bg-white print:text-black">
          {/* Document Header */}
          <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white print:text-black">
                  CareCanvas — Clinical Pharmacist Regimen Map
                </h1>
                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-700 text-[10px] font-bold border border-sky-200 print:hidden">
                  Verified LocalVault Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-600 print:text-gray-600 mt-1">
                Patient: <strong className="text-white print:text-black">{bundle.patientName}</strong> | Generated: {new Date(bundle.generatedDate).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right text-xs text-slate-600 print:text-gray-600">
              <span className="font-bold text-sky-400 print:text-black block">Privacy-Preserving On-Device Vault</span>
              <span>Zero PHI Cloud Transmission</span>
            </div>
          </div>

          {/* Section 1: Brand / Generic Crosswalk Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-sky-400 print:text-gray-800">
              1. Active Medication Regimen & Crosswalk
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden print:border-gray-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-white border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-2.5">Brand Name</th>
                    <th className="p-2.5">Generic Chemical</th>
                    <th className="p-2.5">Therapeutic Class</th>
                    <th className="p-2.5">Strength / Dose</th>
                    <th className="p-2.5">Frequency / Timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 print:divide-gray-200">
                  {bundle.brandGenericCrosswalk.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="p-2.5 font-bold text-white print:text-black">{item.brand}</td>
                      <td className="p-2.5 text-slate-700 print:text-gray-800">{item.generic}</td>
                      <td className="p-2.5 text-slate-600 print:text-gray-600">{item.class || 'Prescription Drug'}</td>
                      <td className="p-2.5 font-mono font-semibold text-emerald-400 print:text-black">{item.dose}</td>
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
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 print:text-gray-800">
                2. Flagged Drug Interactions ({bundle.drugInteractions.length})
              </h3>
              <div className="space-y-2">
                {bundle.drugInteractions.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">No drug-drug interaction conflicts flagged.</p>
                ) : (
                  bundle.drugInteractions.map((arc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1 print:bg-gray-50 print:border-gray-300"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-white print:text-black">{arc.drugA} + {arc.drugB}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                            arc.severity === 'CONTRAINDICATED'
                              ? 'bg-rose-500/20 text-rose-700 border border-rose-200'
                              : 'bg-amber-500/20 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {arc.severity}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] print:text-gray-700">{arc.mechanism}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Diet & Meal Rules */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 print:text-gray-800">
                3. Dietary & Timing Rules ({bundle.dietTimingRules.length})
              </h3>
              <div className="space-y-2">
                {bundle.dietTimingRules.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">No specific food-drug restrictions noted.</p>
                ) : (
                  bundle.dietTimingRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1 print:bg-gray-50 print:border-gray-300"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-white print:text-black">{rule.drugName}</span>
                        <span className="text-[10px] text-amber-400 font-semibold">{rule.badgeText}</span>
                      </div>
                      <p className="text-slate-700 text-[11px] print:text-gray-700">{rule.clinicalGuidance}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Pharmacist Sign-Off & Verification Block */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:bg-gray-50 print:border-gray-300">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-sky-400 shrink-0" />
              <div>
                <h4 className="font-bold text-xs text-white print:text-black">
                  Clinical Pharmacist Verification Block
                </h4>
                <p className="text-[11px] text-slate-600 print:text-gray-600">
                  Reviewed for drug interactions, therapeutic duplication, and renal dosage adjustment.
                </p>
              </div>
            </div>
            <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-200 pl-0 sm:pl-4 pt-2 sm:pt-0 w-full sm:w-auto">
              <div className="text-xs font-mono text-slate-700 print:text-black">
                Signature: ______________________
              </div>
              <div className="text-[10px] text-slate-600 mt-1">
                Date: {new Date().toLocaleDateString()} | License / NPI: _________
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
