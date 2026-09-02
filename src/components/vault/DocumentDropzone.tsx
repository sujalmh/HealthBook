import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, ArrowRight, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { runDocumentOCR, type OCRResult } from '@/core/ai/ocr';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import type { DocumentRecord } from '@/types/vault';

export const DocumentDropzone: React.FC<{
  patientId?: string;
  onExtracted?: () => void;
  onDocumentAdded?: (docId: string) => void;
  onBusyChange?: (busy: boolean) => void;
}> = ({ patientId, onExtracted, onDocumentAdded, onBusyChange }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentStage, setCurrentStage] = useState<'ocr' | 'ai' | 'idle'>('idle');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isOcrExpanded, setIsOcrExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractionPath = 'ocr_then_ai' as const;

  const effectivePatientId = resolvePatientId(patientId) || 'patient-unknown';

  const handleRealExtract = async (file: File, fileDataUrl: string, rawText?: string) => {
    setIsExtracting(true);
    setCurrentStage('ocr');
    setOcrResult(null);
    onBusyChange?.(true);
    try {
      const documentId = `doc_${Date.now()}_${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
      const docType = file.type.includes('pdf') ? 'general_pdf' : file.type.includes('image') ? 'lab_slip_photo' : 'general_pdf';

      let ocrOutputText = rawText || '';
      let ocrMeta: OCRResult | null = null;

      try {
        const ocr = await runDocumentOCR(fileDataUrl);
        if (ocr.markdown) {
          ocrMeta = ocr;
          setOcrResult(ocr);
          ocrOutputText = ocr.markdown;
        }
      } catch {
        // fallback to rawText
      }

      await localVault.addDocument({
        id: documentId,
        patientId: effectivePatientId,
        fileName: file.name,
        name: file.name,
        docType: docType as unknown as DocumentRecord['docType'],
        pageCount: ocrMeta?.pageCount ?? 1,
        uploadTimestamp: new Date().toISOString(),
        extractedText: ocrOutputText,
        extractedFactIds: [],
      });

      onDocumentAdded?.(documentId);

      setCurrentStage('ai');

      const execParams: Record<string, unknown> = {
        documentId,
        rawText: ocrOutputText || file.name,
        imageDataUrl: fileDataUrl,
        imageBlob: fileDataUrl,
        docType,
        documentType: file.type,
        extractionPath,
      };

      const result = await webMCPEngine.execute('extract_fact', execParams);

      eventBus.dispatchToast({
        type: 'success',
        title: 'Done',
        message: (result as unknown as { plainLanguageSummary?: string }).plainLanguageSummary || 'We found details from your paper. Please review below.',
      });

      if (onExtracted) onExtracted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please try again with a clear PDF or photo.';
      eventBus.dispatchToast({
        type: 'error',
        title: 'Could not read paper',
        message: msg,
      });
    } finally {
      setIsExtracting(false);
      setCurrentStage('idle');
      onBusyChange?.(false);
    }
  };

  const copyOcrToClipboard = () => {
    if (!ocrResult?.markdown) return;
    navigator.clipboard.writeText(ocrResult.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const isAllowed = allowed.some((t) => file.type.includes(t.split('/')[1]) || file.name.match(/\.(pdf|jpe?g|png)$/i));
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
      await handleRealExtract(file, dataUrl);
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
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 text-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0 shadow-sm">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">Add your papers</h3>
          <p className="text-xs text-slate-500 leading-relaxed">Drop a PDF or photo — we'll read it for you</p>
        </div>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center cursor-pointer transition-all ${
          isDragging ? 'border-slate-900 bg-slate-50 shadow-inner' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
        } ${isExtracting ? 'opacity-60 pointer-events-none' : ''}`}
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
            <p className="text-sm font-semibold text-slate-900">Drop a PDF or photo here, or tap to choose</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">We read your file and find medicines, tests and notes for you to review</p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black px-4 py-2 rounded-full shadow-sm">
            <span>Choose file</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {isExtracting && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-sm font-bold text-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
              <span>{currentStage === 'ocr' ? 'Reading your paper...' : 'Finding health details...'}</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-700">
              {currentStage === 'ocr' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className={`h-full transition-all duration-700 ${currentStage === 'ocr' ? 'w-1/2 bg-amber-500' : 'w-5/6 bg-emerald-500'}`} />
          </div>
          <p className="text-xs text-slate-500">
            {currentStage === 'ocr'
              ? 'We are reading text and tables from your paper.'
              : 'We are finding medicines, lab results and other notes. Please wait — do not close this page.'}
          </p>
        </div>
      )}

      {ocrResult && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsOcrExpanded(!isOcrExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
          >
            <span className="text-xs font-semibold text-slate-700">
              Show reading details {ocrResult.pageCount ? `(${ocrResult.pageCount} ${ocrResult.pageCount === 1 ? 'page' : 'pages'})` : ''}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 hidden sm:inline">{ocrResult.markdown.length} characters</span>
              {isOcrExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </span>
          </button>
          {isOcrExpanded && (
            <div className="p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">What we read</span>
                <button
                  type="button"
                  onClick={copyOcrToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-black text-white rounded-lg"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-slate-800 font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-72 overflow-auto whitespace-pre-wrap leading-relaxed">
                {ocrResult.markdown}
              </pre>
              {ocrResult.tables && ocrResult.tables.length > 0 && (
                <p className="text-[11px] text-slate-500">{ocrResult.tables.length} tables found — included above.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
