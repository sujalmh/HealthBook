import React, { useState, useEffect, useRef } from 'react';
import { FileText, ZoomIn, ZoomOut, RotateCcw, Crosshair, Sparkles } from 'lucide-react';
import { BoundingBox } from '@/types/vault';
import { eventBus, HighlightDocumentPayload } from '@/core/events/eventBus';

interface BoundingBoxViewerProps {
  documentId?: string;
  documentTitle?: string;
  boundingBox?: BoundingBox | null;
  onClose?: () => void;
}

export const BoundingBoxViewer: React.FC<BoundingBoxViewerProps> = ({
  documentId = 'doc-discharge-001',
  documentTitle = 'St. Jude Medical Center — Discharge Summary & Lab Slip',
  boundingBox: propBox,
  onClose,
}) => {
  const [activeBox, setActiveBox] = useState<BoundingBox | null>(propBox || null);
  const [zoom, setZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propBox) {
      setActiveBox(propBox);
    }
  }, [propBox]);

  useEffect(() => {
    const unsub = eventBus.onHighlightDocument((payload: HighlightDocumentPayload) => {
      setActiveBox(payload.boundingBox || null);
      // Auto-focus and slight zoom
      setZoom(1.1);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.7));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="bg-white border border-canvas-border rounded-2xl p-3 sm:p-5 shadow-2xl flex flex-col h-full text-slate-800">
      {/* Header with zoom controls */}
      <div className="flex items-center justify-between gap-2 border-b border-canvas-border pb-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary-light border border-primary-border rounded-xl text-primary-text shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{documentTitle}</h3>
            <p className="text-caption text-muted font-mono">ID: {documentId} • Page 1 of 1</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-canvas-muted border border-canvas-border rounded-xl p-1 text-xs">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-caption text-slate-700 min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="Zoom In"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-white rounded-lg text-muted hover:text-slate-800 transition-colors ml-1 border-l border-canvas-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="Reset Zoom"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close document viewer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Document Viewport Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-canvas-muted rounded-xl border border-canvas-border p-3 sm:p-4 relative flex items-center justify-center min-h-[380px]"
      >
        <div
          className="relative bg-white text-slate-900 rounded-xl shadow-xl transition-transform duration-200 origin-center p-6 sm:p-8 select-text font-serif text-[11px] leading-relaxed border border-canvas-border max-w-lg w-full"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Simulated Medical Document Layout */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-2">
            <div>
              <h1 className="font-bold text-sm tracking-wider uppercase">ST. JUDE MEDICAL CENTER</h1>
              <p className="text-caption text-muted font-sans font-medium">Inpatient Discharge Summary & Transition Record</p>
            </div>
            <div className="text-right text-caption text-muted font-mono">
              <div>Date: Aug 28, 2026</div>
              <div>MRN: #940-281-CC</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-caption bg-canvas-muted p-2.5 rounded-xl mb-4 font-sans border border-canvas-border">
            <div><strong>Patient:</strong> Shanti Devi (72 F)</div>
            <div><strong>Attending:</strong> Dr. Sarah Patel, MD</div>
            <div><strong>Admission:</strong> Aug 22, 2026</div>
            <div><strong>Discharge:</strong> Aug 28, 2026</div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="font-bold font-sans text-caption text-slate-800 uppercase border-b border-canvas-border pb-0.5 mb-1">
                Discharge Diagnoses
              </h4>
              <p className="text-slate-700">1. Chronic Kidney Disease (Stage 3b), baseline eGFR ~32.</p>
              <p className="text-slate-700">2. Type 2 Diabetes Mellitus, suboptimally controlled.</p>
              <p className="text-slate-700">3. Non-valvular Atrial Fibrillation (CHA2DS2-VASc = 4).</p>
            </div>

            <div>
              <h4 className="font-bold font-sans text-caption text-slate-800 uppercase border-b border-canvas-border pb-0.5 mb-1">
                Discharge Laboratory Biomarkers
              </h4>
              <div className="font-mono text-caption space-y-0.5 text-slate-800">
                <p>• Serum Creatinine: 1.9 mg/dL (Ref: 0.6 - 1.2 mg/dL) [HIGH]</p>
                <p>• eGFR: 32 mL/min/1.73m2 (Ref: &gt;60 mL/min/1.73m2) [LOW]</p>
                <p>• Serum Potassium (K+): 4.8 mEq/L (Ref: 3.5 - 5.0 mEq/L) [NORMAL]</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold font-sans text-caption text-slate-800 uppercase border-b border-canvas-border pb-0.5 mb-1">
                Reconciled Discharge Medications
              </h4>
              <div className="font-sans text-caption space-y-1 text-slate-800">
                <p>1. <strong>Apixaban (Eliquis)</strong> 5 mg PO BID (Stroke prophylaxis) - <span className="text-primary-text font-semibold">[NEW]</span></p>
                <p>2. <strong>Metformin HCl</strong> 1000 mg PO BID with meals - <span className="text-amber-700 font-semibold">[DOSE INCREASED]</span></p>
                <p>3. <strong>Atorvastatin</strong> 40 mg PO QHS - <span className="text-muted font-semibold">[CONTINUED]</span> (Avoid Grapefruit)</p>
                <p>4. <strong>Lisinopril</strong> 20 mg PO Daily - <span className="text-rose-700 font-semibold">[STOPPED / HELD DUE TO AKI]</span></p>
              </div>
            </div>

            <div>
              <h4 className="font-bold font-sans text-caption text-slate-800 uppercase border-b border-canvas-border pb-0.5 mb-1">
                Allergies & Warnings
              </h4>
              <p className="text-rose-700 font-semibold text-caption">
                • Penicillin (Severe Anaphylaxis) • Avoid NSAIDs (Ibuprofen/Naproxen)
              </p>
            </div>
          </div>

          {/* Render Vector Bounding Box Overlay if coordinates present */}
          {activeBox && (
            <div
              className="absolute pointer-events-none rounded-sm transition-all duration-300 bounding-box-highlight border-2 border-primary"
              style={{
                top: `${activeBox.y * 100}%`,
                left: `${activeBox.x * 100}%`,
                width: `${activeBox.width * 100}%`,
                height: `${activeBox.height * 100}%`,
                backgroundColor: activeBox.highlightColor || 'rgba(79, 70, 229, 0.22)',
              }}
            >
              <div className="absolute -top-6 left-0 flex items-center gap-1 bg-primary text-white font-sans font-bold text-caption px-2 py-0.5 rounded-lg shadow-lg whitespace-nowrap">
                <Sparkles className="w-3 h-3" />
                <span>Verified OCR Source</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bounding Box Source Snippet Footer */}
      {activeBox && (
        <div className="mt-3 p-3 bg-canvas-muted rounded-xl border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted whitespace-nowrap">Verbatim Text Span:</span>
            <span className="font-mono text-primary-text font-medium truncate">"{activeBox.textSnippet}"</span>
          </div>
          <span className="text-caption text-muted font-mono whitespace-nowrap">
            X: {Math.round(activeBox.x * 100)}% Y: {Math.round(activeBox.y * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};
