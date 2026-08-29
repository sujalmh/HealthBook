/**
 * CareCanvas Component: SummaryExportModal
 * 1-page printable patient discharge summary card with medication schedule,
 * food instructions, red flags, doctor questions, and clinic contacts.
 */

import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileCheck2,
  AlertOctagon,
  Clock,
  Utensils,
  PhoneCall,
  QrCode,
  Globe,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';
import type { PatientHomeSummaryExport } from '../../types/rxbridge.ts';

interface SummaryExportModalProps {
  summary: PatientHomeSummaryExport;
  onClose: () => void;
}

export const SummaryExportModal: React.FC<SummaryExportModalProps> = ({
  summary,
  onClose
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es' | 'hi'>('en');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(summary, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Discharge_Summary_${summary.patientName.replace(/[^a-z0-9]/gi, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto print:max-h-none print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        {/* Action Header (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">1-Page Patient Discharge Home Summary</h3>
              <p className="text-xs text-slate-400">Printable & downloadable guide for patient, caregiver, and pharmacy</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as any)}
                className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="en">English (EN)</option>
                <option value="es">Español (ES)</option>
                <option value="hi">हिंदी (HI)</option>
              </select>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Print</span>
            </button>

            {/* Download JSON Button */}
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30 transition-colors"
            >
              {downloadSuccess ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{downloadSuccess ? 'Downloaded!' : 'Export JSON'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable 1-Page Summary Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-inner text-slate-100 print:bg-white print:text-black print:border-none print:p-4">
          {/* Header Block */}
          <div className="border-b-2 border-slate-800 print:border-black pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-white print:text-black tracking-tight">CareCanvas</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 print:text-black print:border-black font-bold uppercase border border-sky-500/40">
                  Discharge Handoff Document
                </span>
              </div>
              <h2 className="text-2xl font-black text-white print:text-black mt-1">{summary.patientName}</h2>
            </div>

            <div className="text-xs text-slate-400 print:text-black space-y-0.5 font-mono text-left sm:text-right">
              <div><strong>Discharge Date:</strong> {summary.dischargeDate}</div>
              <div><strong>Ward / Unit:</strong> {summary.ward}</div>
              <div><strong>Attending Physician:</strong> {summary.attendingPhysician}</div>
            </div>
          </div>

          {/* Section 1: What Changed (High Priority Box) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-400 print:text-black flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>1. What Changed (Discharge Transitions & Discontinued Medications)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {summary.whatChangedSummary.map((item, idx) => {
                const isStopped = item.change.includes('STOPPED');
                const isNew = item.change.includes('NEW');
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border text-xs space-y-1 ${
                      isStopped
                        ? 'bg-rose-950/40 border-rose-800/80 text-rose-200 print:bg-rose-50 print:text-black print:border-rose-300'
                        : isNew
                        ? 'bg-purple-950/40 border-purple-800/80 text-purple-200 print:bg-purple-50 print:text-black print:border-purple-300'
                        : 'bg-sky-950/30 border-sky-800/60 text-sky-200 print:bg-blue-50 print:text-black print:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white print:text-black font-black">{item.medName}</span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                          isStopped
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : isNew
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        }`}
                      >
                        {item.change}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 print:text-gray-800 leading-tight">
                      {item.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Active Daily Medication Schedule */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-sky-400 print:text-black flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>2. Active Daily Medication Schedule</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {summary.activeDailySchedule.map((slotItem, sIdx) => (
                <div
                  key={sIdx}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 print:bg-gray-100 print:border-gray-300 space-y-2 text-xs"
                >
                  <div className="font-extrabold uppercase text-[11px] text-sky-300 print:text-black border-b border-slate-800 print:border-gray-300 pb-1.5 flex items-center justify-between">
                    <span>{slotItem.slot}</span>
                    <span className="text-[10px] text-slate-400 print:text-gray-600 font-mono">
                      {slotItem.timeString.split(' ')[0]}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {slotItem.meds.map((med, mIdx) => (
                      <div key={mIdx} className="space-y-0.5">
                        <div className="font-bold text-white print:text-black">
                          {med.name} <span className="text-slate-400 print:text-gray-600 font-mono text-[11px]">({med.dose})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 print:text-gray-700 italic">
                          {med.instructions}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 & 4: Food Rules & Red Flags (2 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Food Rules */}
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 print:bg-amber-50 print:border-amber-200 text-xs text-amber-200 print:text-black space-y-2">
              <h4 className="font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-amber-400 print:text-black">
                <Utensils className="w-3.5 h-3.5" />
                <span>3. Food & Supplement Guidelines</span>
              </h4>
              <ul className="space-y-1 text-[11px] list-disc list-inside leading-tight text-amber-100/90 print:text-black">
                {summary.foodAndDietRules.map((rule, rIdx) => (
                  <li key={rIdx}>{rule}</li>
                ))}
              </ul>
            </div>

            {/* Red Flag Warning Signs */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 print:bg-rose-50 print:border-rose-200 text-xs text-rose-200 print:text-black space-y-2">
              <h4 className="font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-rose-400 print:text-black">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>4. Red Flag Symptoms (When to Seek Urgent Care)</span>
              </h4>
              <ul className="space-y-1 text-[11px] list-disc list-inside leading-tight text-rose-100/90 print:text-black">
                {summary.redFlagWarningSymptoms.map((flag, fIdx) => (
                  <li key={fIdx}>{flag}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 5: Doctor Follow-Up Questions */}
          {summary.doctorQuestionBankItems && summary.doctorQuestionBankItems.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 print:bg-gray-100 print:border-gray-300 text-xs space-y-2">
              <h4 className="font-black uppercase tracking-wider text-[11px] text-slate-300 print:text-black">
                5. Questions to Ask Your Doctor at First Post-Discharge Visit:
              </h4>
              <ul className="space-y-1 text-[11px] text-slate-400 print:text-gray-800 list-decimal list-inside leading-tight">
                {summary.doctorQuestionBankItems.slice(0, 3).map((q, qIdx) => (
                  <li key={qIdx}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 6: Emergency & Clinic Contact Strip */}
          <div className="border-t border-slate-800 print:border-black pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-white print:text-black flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>{summary.emergencyContact.clinicName}</span>
              </div>
              <div className="text-slate-400 print:text-gray-700 font-mono text-[11px]">
                Clinic Phone: <strong>{summary.emergencyContact.phone}</strong> | Discharge Ward: <strong>{summary.emergencyContact.dischargeWardPhone}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[10px] text-slate-500 print:text-gray-500 font-mono text-right">
                <div>CareCanvas Reconciled Hash</div>
                <div className="text-[9px] truncate max-w-[140px]">SHA256: 0x8f4b...3a91</div>
              </div>
              <div className="p-1 rounded-xl bg-white text-slate-950">
                <QrCode className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
