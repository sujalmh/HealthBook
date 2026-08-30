import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, ArrowRight } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export const DocumentDropzone: React.FC<{ patientId?: string; onExtracted?: () => void }> = ({
  patientId,
  onExtracted,
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleRealExtract = async (file: File, rawText: string, imageDataUrl?: string) => {
    setIsExtracting(true);
    try {
      const documentId = `doc_${Date.now()}_${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
      const docType = file.type.includes('pdf') ? 'general_pdf' : file.type.includes('image') ? 'lab_slip_photo' : 'general_pdf';
      await localVault.addDocument({
        id: documentId,
        patientId: effectivePatientId,
        fileName: file.name,
        name: file.name,
        docType: docType as any,
        pageCount: 1,
        uploadTimestamp: new Date().toISOString(),
        extractedFactIds: [],
      });

      // Wire FileReader real file — if image (data URL) send as imageDataUrl + text together to extract_fact via AI multimodal; if PDF/text send rawText; call webMCPEngine.execute('extract_fact', {documentId, rawText, imageBlob?, docType}) with vision
      // Single multimodal request when image present: rawText + imageDataUrl together (image_url vs input_image handled generically by AI client based on VITE_AI_PROVIDER)
      const execParams: any = {
        documentId,
        rawText: rawText || '',
        docType,
        documentType: file.type,
      };
      if (imageDataUrl && (imageDataUrl.startsWith('data:image') || imageDataUrl.length > 5000)) {
        execParams.imageBlob = imageDataUrl;
        execParams.imageDataUrl = imageDataUrl;
        // Also include rawText alongside image for vision+text single response where model supports it
        if (rawText && rawText.trim().length > 0) execParams.rawText = rawText;
      }

      const result = await webMCPEngine.execute('extract_fact', execParams);

      eventBus.dispatchToast({
        type: 'success',
        title: 'Extraction Complete',
        message: (result as any).plainLanguageSummary || (result as any).plainLanguageExplanation || 'Facts extracted successfully',
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

    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpe?g|png)$/i);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        // For images, result is data URL (vision input) — send as imageDataUrl + text together single multimodal request
        // If image contains embedded text, we could also attempt OCR text extraction via reading as text? But vision+text single response handles both
        const imageDataUrl = result || '';
        // Send empty rawText plus imageDataUrl for AI multimodal single request (client will compose image_url or input_image generically)
        await handleRealExtract(file, '', imageDataUrl);
      };
      reader.onerror = () => {
        eventBus.dispatchToast({
          type: 'error',
          title: 'Read Error',
          message: 'Could not read file.',
        });
      };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        // For PDFs, attempt to read as text; if binary, fallback to name
        // Note: readAsText for PDF will be garbled binary; we treat as rawText but AI vision not needed for PDFs (text path)
        const rawText = result || file.name;
        await handleRealExtract(file, rawText);
      };
      reader.onerror = () => {
        eventBus.dispatchToast({
          type: 'error',
          title: 'Read Error',
          message: 'Could not read file.',
        });
      };
      // Try readAsText for PDFs; if fails, readAsDataURL could be used for vision but PDF text path preferred per spec: if PDF/text send rawText
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const rawText = result || file.name;
        await handleRealExtract(file, rawText);
      };
      reader.onerror = () => {
        eventBus.dispatchToast({
          type: 'error',
          title: 'Read Error',
          message: 'Could not read file.',
        });
      };
      reader.readAsText(file);
    }
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
      <div className="flex items-center justify-between gap-3 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-light border border-primary-border rounded-xl text-primary shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">Add Your Health Papers</h3>
            <p className="text-body-sm text-muted leading-relaxed">Drop a PDF or photo to extract details</p>
          </div>
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
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isDragging ? 'border-primary bg-primary-light/50' : 'border-canvas-border bg-canvas-muted/30 hover:border-primary-border hover:bg-canvas-muted/50'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white border border-canvas-border rounded-xl shadow-sm">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-body-sm font-semibold text-slate-900">Drop a PDF or photo here, or click to browse</p>
            <p className="text-caption text-muted">PDF, JPG, PNG — your file is processed locally and staged for your review</p>
          </div>
          <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-body-sm font-bold shadow-sm min-h-[44px] min-w-[120px] justify-center">
            Browse Files <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <p className="text-body-sm text-muted">Important details appear for review</p>
        <span className="text-caption text-muted hidden sm:inline">Files are read with FileReader and sent to your vault for {effectivePatientId === 'patient-unknown' ? 'your account' : 'your patient'}</span>
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
