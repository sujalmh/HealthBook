import React, { useState } from 'react';
import { UploadCloud, FileText, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export const DocumentDropzone: React.FC<{ patientId?: string; onExtracted?: () => void }> = ({
  patientId = 'patient-s-devi',
  onExtracted,
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string>('discharge');

  const sampleDocuments = [
    {
      id: 'doc-discharge-001',
      title: 'St. Jude Discharge Summary (Aug 28, 2026)',
      type: 'discharge_summary',
      description: 'Contains 3-list meds (Apixaban NEW, Metformin doubled, Lisinopril held), CKD 3b, eGFR 32, Penicillin allergy.',
      rawText: 'ST JUDE MEDICAL CENTER Discharge Summary. Diagnoses: CKD Stage 3b, Type 2 Diabetes. Labs: eGFR 32 mL/min/1.73m2, Creatinine 1.9 mg/dL, Potassium 4.8 mEq/L. Meds: Apixaban 5mg PO BID, Metformin HCl 1000mg PO BID, Atorvastatin 40mg PO QHS. Allergies: Penicillin.',
    },
    {
      id: 'doc-lab-homelab-001',
      title: 'Quest Diagnostics Remote Renal Panel (Sept 2026)',
      type: 'lab_report',
      description: 'Prescribed home due card follow-up: Serum Creatinine 1.9 mg/dL, eGFR 28 mL/min/1.73m2.',
      rawText: 'QUEST DIAGNOSTICS Renal Function Panel. Patient: Shanti Devi. Serum Creatinine: 1.9 mg/dL [H]. eGFR: 28 mL/min/1.73m2 [L]. Blood Urea Nitrogen (BUN): 28 mg/dL.',
    },
  ];

  const handleExtractSample = async (sample: (typeof sampleDocuments)[0]) => {
    setIsExtracting(true);
    try {
      // 1. Ensure document is registered in LocalVault
      await localVault.addDocument({
        id: sample.id,
        patientId,
        fileName: sample.title,
        name: sample.title,
        docType: sample.type as any,
        pageCount: 1,
        uploadTimestamp: new Date().toISOString(),
        extractedFactIds: [],
      });

      // 2. Trigger extract_fact WebMCP Tool
      const result = await webMCPEngine.execute('extract_fact', {
        documentId: sample.id,
        rawText: sample.rawText,
        documentType: sample.type,
      });

      eventBus.dispatchToast({
        type: 'success',
        title: 'Extraction Complete',
        message: result.plainLanguageSummary || result.plainLanguageExplanation || 'Facts extracted successfully',
      });

      if (onExtracted) onExtracted();
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Extraction Error',
        message: err?.message || 'Failed to extract facts',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Add Your Health Papers</h3>
            <p className="text-xs text-slate-400">
              Drop a PDF or photo — we read it safely on your device, nothing leaves it.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
          🔒 Private on your device
        </span>
      </div>

      {/* Sample Document Selectors for Fast Verification & Live Demo */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Try an example or drop your own file
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sampleDocuments.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedSample(doc.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedSample === doc.id
                  ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-100">{doc.title}</span>
                </div>
                {selectedSample === doc.id && <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{doc.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trigger Extraction Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="text-xs text-slate-400">
          We'll pull out the important details for you to review
        </div>
        <button
          onClick={() => {
            const doc = sampleDocuments.find((d) => d.id === selectedSample) || sampleDocuments[0];
            handleExtractSample(doc);
          }}
          disabled={isExtracting}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow hover:shadow-sky-500/30 disabled:opacity-50"
        >
          {isExtracting ? (
            <>
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
              Reading...
            </>
          ) : (
            <>
              <span>Read Document</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
