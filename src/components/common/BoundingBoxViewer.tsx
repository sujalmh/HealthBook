import React, { useState, useEffect, useRef } from 'react';
import { FileText, ZoomIn, ZoomOut, RotateCcw, Crosshair, Sparkles } from 'lucide-react';
import { BoundingBox } from '@/types/vault';
import { eventBus, HighlightDocumentPayload } from '@/core/events/eventBus';
import { localVault } from '@/core/vault/LocalVault';

interface BoundingBoxViewerProps {
  documentId?: string;
  documentTitle?: string;
  boundingBox?: BoundingBox | null;
  onClose?: () => void;
}

export const BoundingBoxViewer: React.FC<BoundingBoxViewerProps> = ({
  documentId,
  documentTitle = 'Your paper',
  boundingBox: propBox,
  onClose,
}) => {
  const [activeBox, setActiveBox] = useState<BoundingBox | null>(propBox || null);
  const [zoom, setZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<any | null>(null);

  useEffect(() => {
    if (propBox) {
      setActiveBox(propBox);
    }
  }, [propBox]);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      return;
    }
    try {
      const found = localVault.getDocument(documentId);
      if (found) setDoc(found);
      else {
        // fallback scan by patient — try all docs
        const all = (localVault as any).documents ? Array.from((localVault as any).documents.values()) : [];
        const match = all.find((d: any) => d.id === documentId);
        setDoc(match || null);
      }
    } catch {
      setDoc(null);
    }
  }, [documentId]);

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

  const displayTitle = doc?.fileName || doc?.name || documentTitle;
  const displayMeta = doc ? `${doc.fileName || doc.name || 'Paper'} • ${doc.pageCount || 1} ${doc.pageCount === 1 ? 'page' : 'pages'}` : 'No paper yet';
  return (
    <div className="bg-white border border-canvas-border rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col h-full text-slate-800">
      {/* Header with zoom controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-canvas-border pb-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary-light border border-primary-border rounded-xl text-primary-text shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{documentId ? displayTitle : 'No paper selected'}</h3>
            <p className="text-caption text-muted truncate">{documentId ? displayMeta : 'Add a paper above'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-canvas-muted border border-canvas-border rounded-xl p-1 text-xs min-h-[36px]">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[28px] min-w-[28px] flex items-center justify-center"
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-caption text-slate-700 min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[28px] min-w-[28px] flex items-center justify-center"
              title="Zoom In"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-white rounded-lg text-muted hover:text-slate-800 transition-colors ml-1 border-l border-canvas-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[28px] min-w-[28px] flex items-center justify-center"
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
        className="flex-1 overflow-auto bg-canvas-muted rounded-xl border border-canvas-border p-3 sm:p-4 relative flex items-center justify-center min-h-[260px] sm:min-h-[380px]"
      >
        <div
          className="relative bg-white text-slate-900 rounded-xl shadow-xl transition-transform duration-200 origin-center p-6 sm:p-8 select-text font-serif text-[11px] leading-relaxed border border-canvas-border max-w-lg w-full"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Paper header */}
          <div className="border-b border-slate-200 pb-3 mb-4 flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-sm tracking-tight truncate max-w-full">{documentId ? displayTitle : 'Your paper will show here'}</h1>
              <p className="text-caption text-muted font-sans truncate">{doc ? `Added ${new Date(doc.uploadTimestamp).toLocaleDateString()} • ${doc.pageCount || 1} pages` : 'Drop a PDF or photo above'}</p>
            </div>
            {doc && (
              <div className="text-right text-caption text-muted font-mono shrink-0">
                <div className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-full text-[11px]">Tap highlight to see source</div>
              </div>
            )}
          </div>

          {documentId && doc ? (
            <div className="space-y-3">
              {doc.extractedText ? (
                <div>
                  <h4 className="font-bold font-sans text-xs text-slate-800 border-b border-canvas-border pb-1 mb-2">What we read from your paper</h4>
                  <pre className="text-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-[320px] overflow-auto bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {doc.extractedText.slice(0, 6000)}
                  </pre>
                  {doc.extractedText.length > 6000 && <p className="text-[11px] text-muted mt-1">Showing first part — full text saved.</p>}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  We saved your paper ({displayTitle}). Reading is in progress or text was empty — your facts are still being found.
                </div>
              )}
              <p className="text-[11px] text-muted">Tip: Tap any item in “Review” below to highlight where it came from.</p>
            </div>
          ) : documentId && !doc ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-900">Paper not found</p>
              <p className="text-caption text-muted">We could not find this paper. Try choosing another one.</p>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-canvas-muted border border-canvas-border flex items-center justify-center mx-auto">
                <FileText className="w-5 h-5 text-muted" />
              </div>
              <p className="text-body-sm font-semibold text-slate-900">No paper selected</p>
              <p className="text-caption text-muted max-w-xs mx-auto">Add a paper above. It will appear here so you can see what we read.</p>
            </div>
          )}

          {/* Highlight overlay if coordinates present */}
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
                <span>Found in your paper</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Highlight footer — simple English */}
      {activeBox && (
        <div className="mt-3 p-3 bg-canvas-muted rounded-xl border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted whitespace-nowrap">Highlight:</span>
            <span className="font-mono text-primary-text font-medium truncate">"{activeBox.textSnippet}"</span>
          </div>
          <span className="text-caption text-muted">From your paper</span>
        </div>
      )}
    </div>
  );
};
