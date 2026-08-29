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
    <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 shadow-sm space-y-5 text-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-light border border-primary-border rounded-xl text-primary shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">Add Your Health Papers</h3>
            <p className="text-body-sm text-muted leading-relaxed">
              Drop a PDF or photo — we read it safely on your device, nothing leaves it.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex text-caption font-semibold text-clinical-emerald bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full whitespace-nowrap">
          🔒 Private on your device
        </span>
      </div>

      {/* Sample Document Selectors for Fast Verification & Live Demo */}
      <div className="space-y-3">
        <div className="text-caption font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Try an example or drop your own file
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sampleDocuments.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedSample(doc.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedSample(doc.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                selectedSample === doc.id
                  ? 'bg-primary-light border-primary-border shadow-sm ring-1 ring-primary/20'
                  : 'bg-canvas-card border-canvas-border hover:border-primary-border/50 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-body-sm font-semibold text-slate-900">{doc.title}</span>
                </div>
                {selectedSample === doc.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </div>
              <p className="text-body-sm text-muted mt-2 leading-relaxed">{doc.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trigger Extraction Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-canvas-border">
        <p className="text-body-sm text-muted">
          We'll pull out the important details for you to review
        </p>
        <button
          onClick={() => {
            const doc = sampleDocuments.find((d) => d.id === selectedSample) || sampleDocuments[0];
            handleExtractSample(doc);
          }}
          disabled={isExtracting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-body-sm font-bold transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 min-h-[44px] shrink-0"
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

      {/* Loading skeleton while extracting */}
      {isExtracting && (
        <div className="rounded-xl border border-canvas-border bg-canvas-muted p-4 space-y-3 animate-pulse">
          <div className="h-3 w-2/3 bg-muted/20 rounded" />
          <div className="h-3 w-full bg-muted/10 rounded" />
          <div className="h-3 w-5/6 bg-muted/10 rounded" />
        </div>
      )}
    </div>
  );
};
