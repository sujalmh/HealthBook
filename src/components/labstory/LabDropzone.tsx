import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, ArrowRight } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import { runDocumentOCR } from '@/core/ai/ocr';

interface LabDropzoneProps {
  patientId: string;
  activeProfile?: { userId: string; name: string; role: string; isProxy?: boolean };
  onLabAdded?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export const LabDropzone: React.FC<LabDropzoneProps> = ({ patientId, activeProfile, onLabAdded, onBusyChange }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<'ocr' | 'ai' | 'idle'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectivePatientId = resolvePatientId(patientId);

  const handleLabExtract = async (file: File, fileDataUrl: string) => {
    setIsExtracting(true);
    setStage('ocr');
    onBusyChange?.(true);
    try {
      const documentId = `doc_lab_${Date.now()}_${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
      const docType = file.type.includes('pdf') ? 'general_pdf' : 'lab_slip_photo';

      let ocrText = '';
      let pageCount = 1;
      try {
        const ocr = await runDocumentOCR(fileDataUrl);
        if (ocr.markdown) {
          ocrText = ocr.markdown;
          pageCount = ocr.pageCount || 1;
        }
      } catch {  }

      await localVault.addDocument({
        id: documentId,
        patientId: effectivePatientId,
        fileName: file.name,
        name: file.name,
        docType: docType as unknown as import('@/types/vault').DocumentRecord['docType'],
        pageCount,
        uploadTimestamp: new Date().toISOString(),
        extractedText: ocrText || file.name,
        extractedFactIds: [],
      } as unknown as import('@/types/vault').DocumentRecord);

      setStage('ai');

      const context = {
        patientId: effectivePatientId,
        activeProfile: {
          userId: activeProfile?.userId || effectivePatientId,
          name: activeProfile?.name || 'Patient',
          role: (activeProfile?.role === 'caregiver' || activeProfile?.role === 'doctor' ? activeProfile.role : 'patient') as 'patient' | 'caregiver' | 'doctor',
          isProxy: Boolean(activeProfile?.isProxy),
        },
        vault: localVault,
        eventBus,
      };

      const result = await webMCPEngine.execute(
        'extract_labs',
        {
          documentId,
          patientId: effectivePatientId,
          rawText: ocrText || file.name,
          imageDataUrl: fileDataUrl,
          imageBlob: fileDataUrl,
        } as unknown as Record<string, unknown>,
        context as unknown as Record<string, unknown>
      );

      if (result.success) {
        const count = Array.isArray(result.data) ? result.data.length : 0;
        if (count > 0) {
          eventBus.dispatchToast({
            type: 'success',
            title: 'Lab results added',
            message: `We found ${count} test results and added them to your chart.`,
          });
        } else {
          eventBus.dispatchToast({
            type: 'info',
            title: 'No results found',
            message: 'We could not find test results in that file. Try a clearer photo or add manually.',
          });
        }
        onLabAdded?.();
      } else {
        eventBus.dispatchToast({
          type: 'error',
          title: 'Could not read results',
          message: result.error?.message || 'Please try again with a clear PDF or photo.',
        });
      }
    } catch (err) {
      const msg = (err as unknown as { message?: string })?.message || 'Please try again with a clear PDF or photo.';
      eventBus.dispatchToast({
        type: 'error',
        title: 'Could not read paper',
        message: msg,
      });
    } finally {
      setIsExtracting(false);
      setStage('idle');
      onBusyChange?.(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const isAllowed =
      allowed.some((t) => file.type.includes(t.split('/')[1]) || file.name.match(/\.(pdf|jpe?g|png)$/i)) ||
      file.type === '' && /\.(pdf|jpe?g|png)$/i.test(file.name);
    if (!isAllowed && file.type) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Unsupported file',
        message: 'Please use a PDF, JPG or PNG.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Read error',
        message: 'Could not read file.',
      });
    };
    reader.onload = async () => {
      const dataUrl = (reader.result as string) || '';
      await handleLabExtract(file, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !isExtracting && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center cursor-pointer transition-all ${
          isDragging ? 'border-slate-900 bg-slate-50 shadow-inner' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
        } ${isExtracting ? 'opacity-60 pointer-events-none' : ''}`}
        aria-label="Upload lab results"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-white rounded-xl text-slate-700 border border-slate-200 shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Drop a lab PDF or photo here, or tap to choose</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">We read your file and add your test results to the chart</p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black px-4 py-2 rounded-full shadow-sm">
            <span>Choose file</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <p className="text-[11px] text-slate-400">PDF, JPG or PNG — we do the rest</p>
        </div>
      </div>

      {isExtracting && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fade-in" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm font-bold text-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" aria-hidden="true" />
              <span>{stage === 'ocr' ? 'Reading your paper...' : 'Finding test results...'}</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-700">
              {stage === 'ocr' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className={`h-full transition-all duration-700 ${stage === 'ocr' ? 'w-1/2 bg-amber-500' : 'w-5/6 bg-emerald-500'}`} />
          </div>
          <p className="text-xs text-slate-500" aria-live="polite">
            {stage === 'ocr'
              ? 'We are reading text and tables from your paper.'
              : 'We are finding your test results. Please wait — do not close this page.'}
          </p>
        </div>
      )}
    </div>
  );
};

