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

  const handleRealExtract = async (file: File, fileDataUrl: string, rawText?: string) => {
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

      // Send the uploaded file data URL directly to AI fact extraction
      const execParams: any = {
        documentId,
        rawText: rawText || file.name,
        imageDataUrl: fileDataUrl,
        imageBlob: fileDataUrl,
        docType,
        documentType: file.type,
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

    // Read the file as a Data URL to upload directly to AI
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
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-primary bg-primary-light/50 shadow-inner'
            : 'border-canvas-border hover:border-primary/50 hover:bg-slate-50/50'
        } ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}
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
            <p className="text-caption text-muted">PDF, JPG, PNG — your file is processed by AI and staged for your review</p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary">
            <span>Select file</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {isExtracting && (
        <div className="p-4 bg-primary-light/40 border border-primary-border rounded-xl flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-body-sm font-medium text-primary">
            AI is analyzing your document and extracting clinical facts...
          </p>
        </div>
      )}
    </div>
  );
};
