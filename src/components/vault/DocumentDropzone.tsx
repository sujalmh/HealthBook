import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, ArrowRight, Zap, Eye, Sparkles, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { runDocumentOCR, type OCRResult } from '@/core/ai/ocr';

export const DocumentDropzone: React.FC<{ patientId?: string; onExtracted?: () => void }> = ({
  patientId,
  onExtracted,
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [extractionPath, setExtractionPath] = useState<'ocr_then_ai' | 'direct_vision'>('ocr_then_ai');
  const [currentStage, setCurrentStage] = useState<'ocr' | 'ai' | 'idle'>('idle');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isOcrExpanded, setIsOcrExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectivePatientId = patientId || (() => {
    try {
      const raw = localStorage.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.userId || parsed?.id || '';
      }
    } catch {}
    return '';
  })() || 'patient-unknown';

  const handleRealExtract = async (file: File, fileDataUrl: string, rawText?: string) => {
    setIsExtracting(true);
    setCurrentStage(extractionPath === 'ocr_then_ai' ? 'ocr' : 'ai');
    setOcrResult(null);
    try {
      const documentId = `doc_${Date.now()}_${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
      const docType = file.type.includes('pdf') ? 'general_pdf' : file.type.includes('image') ? 'lab_slip_photo' : 'general_pdf';

      let ocrOutputText = rawText || '';

      // Step 1: Pre-process with OCR if on Path A
      if (extractionPath === 'ocr_then_ai') {
        const ocr = await runDocumentOCR(fileDataUrl);
        if (ocr.markdown) {
          setOcrResult(ocr);
          ocrOutputText = ocr.markdown;
        }
      }

      await localVault.addDocument({
        id: documentId,
        patientId: effectivePatientId,
        fileName: file.name,
        name: file.name,
        docType: docType as any,
        pageCount: ocrResult?.pageCount || 1,
        uploadTimestamp: new Date().toISOString(),
        extractedText: ocrOutputText,
        extractedFactIds: [],
      });

      // Switch stage to AI
      setCurrentStage('ai');

      // Send to AI fact extraction
      const execParams: any = {
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
        title: 'Extraction Complete',
        message: (result as any).plainLanguageSummary || (result as any).plainLanguageExplanation || 'Facts extracted successfully by AI',
      });

      if (onExtracted) onExtracted();
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Extraction Error',
        message: err?.message || 'Failed to extract facts via AI',
      });
    } finally {
      setIsExtracting(false);
      setCurrentStage('idle');
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

    // Validate type
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const isAllowed = allowed.some((t) => file.type.includes(t.split('/')[1]) || file.name.match(/\.(pdf|jpe?g|png)$/i));
    if (!isAllowed && file.type) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Unsupported file',
        message: 'Please upload a PDF, JPG, or PNG file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Read Error',
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
    <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 shadow-sm space-y-5 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-light border border-primary-border rounded-xl text-primary shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">Add Your Health Papers</h3>
            <p className="text-body-sm text-muted leading-relaxed">Drop a PDF or photo to extract details</p>
          </div>
        </div>

        {/* Extraction Path Switcher */}
        <div className="flex items-center gap-1.5 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-caption shrink-0">
          <button
            type="button"
            onClick={() => setExtractionPath('ocr_then_ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              extractionPath === 'ocr_then_ai'
                ? 'bg-white text-emerald-800 border border-emerald-300 shadow-xs font-bold'
                : 'text-muted hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>OCR + AI (Fast & Precise)</span>
          </button>

          <button
            type="button"
            onClick={() => setExtractionPath('direct_vision')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              extractionPath === 'direct_vision'
                ? 'bg-white text-primary border border-primary-border shadow-xs font-bold'
                : 'text-muted hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
            <span>Direct Vision</span>
          </button>
        </div>
      </div>

      {/* Real File Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-primary bg-primary-light/50 shadow-inner'
            : 'border-canvas-border hover:border-primary/50 hover:bg-slate-50/50'
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
          <div className="p-3 bg-canvas-surface rounded-full text-primary border border-canvas-border shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-body-sm font-semibold text-slate-900">Drop a PDF or photo here, or click to browse</p>
            <p className="text-caption text-muted">
              {extractionPath === 'ocr_then_ai'
                ? '⚡ 2-Stage Pipeline: Mistral Document OCR pre-processing + Structured Clinical AI Synthesis'
                : '👁️ End-to-end multimodal direct vision model'}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary">
            <span>Select file</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Multi-Stage Extraction Progress */}
      {isExtracting && (
        <div className="p-4 bg-gradient-to-r from-primary-light/60 via-amber-50 to-emerald-50 border border-primary-border rounded-xl space-y-2.5 animate-fade-in shadow-xs">
          <div className="flex items-center justify-between text-body-sm font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>
                {currentStage === 'ocr'
                  ? 'Step 1/2: High-Precision OCR Processing (Mistral OCR)...'
                  : 'Step 2/2: Categorical Clinical Fact Extraction (OpenCode AI)...'}
              </span>
            </div>
            <span className="text-caption font-semibold px-2 py-0.5 bg-white border border-canvas-border rounded-md text-primary">
              {currentStage === 'ocr' ? '50%' : '85%'}
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                currentStage === 'ocr' ? 'w-1/2 bg-amber-500' : 'w-5/6 bg-emerald-500'
              }`}
            />
          </div>

          <p className="text-caption text-muted">
            {currentStage === 'ocr'
              ? 'Converting document text and tables into structured Markdown...'
              : 'Extracting medications, labs, conditions, allergies, and daily schedule...'}
          </p>
        </div>
      )}

      {/* OCR Results Display (Markdown Output Preview) */}
      {ocrResult && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-body-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Document OCR Text (Markdown)</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100/80 text-emerald-800 rounded-full border border-emerald-200">
                    {ocrResult.pageCount} {ocrResult.pageCount === 1 ? 'Page' : 'Pages'} • {ocrResult.durationMs}ms
                  </span>
                </h4>
                <p className="text-caption text-muted">
                  High-fidelity Markdown extracted via Mistral OCR with tables and clinical sections preserved.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyOcrToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOcrExpanded(!isOcrExpanded)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                title={isOcrExpanded ? 'Collapse OCR Preview' : 'Expand OCR Preview'}
              >
                {isOcrExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isOcrExpanded && (
            <div className="relative mt-2">
              <div className="bg-slate-950 text-slate-100 font-mono text-xs p-4 rounded-xl max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800 selection:bg-emerald-500 selection:text-white">
                {ocrResult.markdown}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
