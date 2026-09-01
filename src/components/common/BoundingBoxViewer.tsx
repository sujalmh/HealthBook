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
  documentTitle = 'Medical Document',
  boundingBox: propBox,
  onClose,
}) => {
  const [activeDocId, setActiveDocId] = useState<string | undefined>(documentId);
  const [activeFileName, setActiveFileName] = useState<string>(documentTitle);
  const [activeBox, setActiveBox] = useState<BoundingBox | null>(propBox || null);
  const [zoom, setZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Keep prop sync
  useEffect(() => {
    if (documentId) {
      setActiveDocId(documentId);
      if (documentTitle) setActiveFileName(documentTitle);
    }
  }, [documentId, documentTitle]);

  useEffect(() => {
    if (propBox) setActiveBox(propBox);
  }, [propBox]);

  // Listen to highlight events — now includes boundingBox
  useEffect(() => {
    const unsub = eventBus.onHighlightDocument((payload: HighlightDocumentPayload) => {
      if (payload.documentId) {
        setActiveDocId(payload.documentId);
        // try to resolve fileName from vault
        try {
          const doc = localVault.getDocument(payload.documentId) || (localVault as any).documents?.get?.(payload.documentId);
          if (doc?.fileName) setActiveFileName(doc.fileName);
          else if (doc?.name) setActiveFileName(doc.name);
        } catch {}
      }
      if (payload.boundingBox) {
        setActiveBox(payload.boundingBox);
      } else {
        // keep existing box if none, but at least ensure doc highlight visible
        // don't clear existing box unless explicitly null
      }
      setZoom(1.05);
      // smooth scroll to box
      setTimeout(() => {
        if (payload.boundingBox && containerRef.current) {
          const isNormalized = payload.boundingBox.x <= 1 && payload.boundingBox.y <= 1;
          const targetY = isNormalized ? payload.boundingBox.y * 600 : (payload.boundingBox.y / 800) * 600;
          containerRef.current.scrollTo({ top: Math.max(0, targetY - 120), behavior: 'smooth' });
        } else if (containerRef.current) {
          containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 120);
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

  // Derive document and facts for formatted preview
  const activeDoc: any = (() => {
    if (!activeDocId) return null;
    try {
      return localVault.getDocument(activeDocId) || (localVault as any).documents?.get?.(activeDocId) || null;
    } catch { return null; }
  })();

  const factsForDoc: any[] = (() => {
    if (!activeDocId) return [];
    try {
      const all = Array.from((localVault as any).facts?.values?.() || []) as any[];
      return all.filter((f) => f.sourceDocId === activeDocId || f.documentId === activeDocId);
    } catch { return []; }
  })();

  const grouped = (() => {
    const meds = factsForDoc.filter((f) => f.category === 'medication');
    const labs = factsForDoc.filter((f) => f.category === 'lab');
    const allergies = factsForDoc.filter((f) => f.category === 'allergy');
    const conditions = factsForDoc.filter((f) => f.category === 'condition');
    const others = factsForDoc.filter((f) => !['medication','lab','allergy','condition'].includes(f.category));
    return { meds, labs, allergies, conditions, others };
  })();

  const displayFileName = activeDoc?.fileName || activeDoc?.name || activeFileName || (activeDocId ? `${activeDocId}.pdf` : 'Medical Document');
  const displayDocType = activeDoc?.docType || activeDoc?.type || 'general_pdf';
  const displayDate = activeDoc?.uploadTimestamp ? new Date(activeDoc.uploadTimestamp).toLocaleDateString() : '—';
  const pageLabel = activeBox?.pageIndex ? `Page ${activeBox.pageIndex} of 1` : 'Page 1 of 1';

  return (
    <div className="bg-white border border-canvas-border rounded-2xl p-3 sm:p-5 shadow-2xl flex flex-col h-full text-slate-800">
      {/* Header with zoom controls — 44px targets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-canvas-border pb-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary-light border border-primary-border rounded-xl text-primary-text shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{activeDocId ? displayFileName : 'No Document Selected'}</h3>
            <p className="text-caption text-muted font-mono truncate">ID: {activeDocId || '—'} • {pageLabel} {activeDoc ? `• ${displayDocType}` : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-canvas-muted border border-canvas-border rounded-xl p-1 text-xs">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-caption text-slate-700 min-w-[56px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Zoom In"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 hover:bg-white rounded-lg text-muted hover:text-slate-800 transition-colors ml-1 border-l border-canvas-border focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Reset Zoom"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        className="flex-1 overflow-auto bg-canvas-muted rounded-xl border border-canvas-border p-3 sm:p-4 relative flex items-start justify-center min-h-[320px] sm:min-h-[420px]"
      >
        <div
          ref={paperRef}
          className="relative bg-white text-slate-900 rounded-xl shadow-xl transition-transform duration-200 origin-top p-5 sm:p-7 select-text border border-canvas-border max-w-[560px] w-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {/* Paper header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-[13px] tracking-wider uppercase truncate max-w-full">{activeDocId ? displayFileName : 'Medical Document'}</h1>
              <p className="text-caption text-muted font-sans font-medium truncate">Verified Source Preview — locally stored</p>
            </div>
            <div className="text-right text-caption text-muted font-mono shrink-0">
              <div>Date: {displayDate}</div>
              <div className="truncate max-w-[140px]">Ref: {activeDocId ? activeDocId.slice(0, 18) : '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-caption bg-slate-50 p-2.5 rounded-xl mb-4 font-sans border border-canvas-border">
            <div><strong>Document:</strong> {displayFileName.slice(0, 28)}</div>
            <div><strong>Type:</strong> {displayDocType}</div>
            <div><strong>Upload:</strong> {displayDate}</div>
            <div><strong>Pages:</strong> {activeDoc?.pageCount || 1}</div>
          </div>

          {!activeDocId ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-canvas-muted border border-canvas-border flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-muted" />
              </div>
              <p className="text-body-sm font-bold text-slate-900">No document selected</p>
              <p className="text-body-sm text-muted max-w-sm mx-auto leading-relaxed">Tap <span className="font-semibold text-primary">Source</span> on any record to highlight its exact origin here. Your file is processed locally and never leaves your device.</p>
              <p className="text-caption text-muted">Drop a PDF or photo above to extract and preview</p>
            </div>
          ) : factsForDoc.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                <h4 className="font-bold text-body-sm text-amber-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" /> Document ready — extraction in progress
                </h4>
                <p className="text-body-sm text-amber-800 leading-relaxed">We have your file <span className="font-mono font-semibold">{displayFileName}</span>. Facts will appear here after AI extraction and your review.</p>
                <p className="text-caption text-muted">ID: {activeDocId}</p>
              </div>
              <div className="space-y-3 pt-2 border-t border-canvas-border">
                <h4 className="font-bold font-sans text-caption text-slate-700 uppercase tracking-wider">What you’ll see here</h4>
                <div className="grid grid-cols-1 gap-2 text-body-sm text-muted">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-canvas-muted border border-canvas-border"><span className="w-2 h-2 rounded-full bg-primary" /> Medications — dose, timing, food notes</div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-canvas-muted border border-canvas-border"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Labs — value, units, reference range & flag</div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-canvas-muted border border-canvas-border"><span className="w-2 h-2 rounded-full bg-rose-400" /> Allergies & conditions — plain language</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-1.5">
                {grouped.meds.length > 0 && <span className="text-caption font-bold px-2.5 py-1 rounded-full bg-primary-light text-primary-text border border-primary-border">{grouped.meds.length} meds</span>}
                {grouped.labs.length > 0 && <span className="text-caption font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{grouped.labs.length} labs</span>}
                {grouped.allergies.length > 0 && <span className="text-caption font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{grouped.allergies.length} allergies</span>}
                {grouped.conditions.length > 0 && <span className="text-caption font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{grouped.conditions.length} conditions</span>}
              </div>

              {/* Meds section */}
              {grouped.meds.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold font-sans text-caption text-slate-700 uppercase tracking-wider border-b border-canvas-border pb-1 flex items-center justify-between">
                    <span>Medications</span>
                    <span className="text-caption font-normal normal-case text-muted">{grouped.meds.length} items</span>
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-canvas-border">
                    <table className="w-full text-left text-caption">
                      <thead className="bg-canvas-muted text-muted uppercase tracking-wider">
                        <tr><th className="px-3 py-1.5 font-semibold">Name</th><th className="px-3 py-1.5 font-semibold">Value / Dose</th><th className="px-3 py-1.5 font-semibold">Notes</th></tr>
                      </thead>
                      <tbody className="divide-y divide-canvas-border bg-white">
                        {grouped.meds.map((f: any) => {
                          const val = typeof f.value === 'object' ? (f.value?.rawSnippet || JSON.stringify(f.value).slice(0, 60)) : String(f.value || f.factValue || '');
                          const isHighlighted = activeBox?.textSnippet && val.toLowerCase().includes(String(activeBox.textSnippet).toLowerCase().slice(0, 12));
                          return (
                            <tr key={f.id} className={`${isHighlighted ? 'bg-amber-50' : ''} hover:bg-canvas-muted/50`}>
                              <td className="px-3 py-2 font-semibold text-slate-900 truncate max-w-[120px]">{f.name}</td>
                              <td className="px-3 py-2 font-mono text-primary-text font-bold truncate max-w-[120px]">{val} {f.unit}</td>
                              <td className="px-3 py-2 text-muted truncate max-w-[140px]">{(f.plainExplanation || '').slice(0, 80)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Labs section */}
              {grouped.labs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold font-sans text-caption text-slate-700 uppercase tracking-wider border-b border-canvas-border pb-1 flex items-center justify-between">
                    <span>Laboratory Results</span>
                    <span className="text-caption font-normal normal-case text-muted">{grouped.labs.length} markers</span>
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-canvas-border">
                    <table className="w-full text-left text-caption">
                      <thead className="bg-canvas-muted text-muted uppercase tracking-wider">
                        <tr><th className="px-3 py-1.5 font-semibold">Marker</th><th className="px-3 py-1.5 font-semibold">Value</th><th className="px-3 py-1.5 font-semibold">Explanation</th></tr>
                      </thead>
                      <tbody className="divide-y divide-canvas-border bg-white">
                        {grouped.labs.map((f: any) => {
                          const val = typeof f.value === 'object' ? (f.value?.rawSnippet || JSON.stringify(f.value).slice(0, 50)) : String(f.value || f.factValue || '');
                          const isHighlighted = activeBox?.textSnippet && (f.name.toLowerCase().includes(String(activeBox.textSnippet).toLowerCase().slice(0, 8)) || val.toLowerCase().includes(String(activeBox.textSnippet).toLowerCase().slice(0, 8)));
                          return (
                            <tr key={f.id} className={`${isHighlighted ? 'bg-amber-50 ring-1 ring-amber-200' : ''} hover:bg-canvas-muted/50`}>
                              <td className="px-3 py-2 font-semibold text-slate-900">{f.name}</td>
                              <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{val} <span className="font-normal text-muted">{f.unit}</span></td>
                              <td className="px-3 py-2 text-muted leading-snug line-clamp-2">{f.plainExplanation || f.plainNarration || ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Allergies / Conditions */}
              {(grouped.allergies.length > 0 || grouped.conditions.length > 0) && (
                <div className="grid grid-cols-1 gap-4">
                  {grouped.allergies.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold font-sans text-caption text-rose-700 uppercase tracking-wider border-b border-rose-100 pb-1">Allergies & Warnings</h4>
                      <ul className="space-y-1.5">
                        {grouped.allergies.map((f: any) => (
                          <li key={f.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-body-sm text-rose-900 flex items-start justify-between gap-2">
                            <span><strong>{f.name}</strong> — {f.plainExplanation || String(f.value || '').slice(0, 100)}</span>
                            {activeBox?.textSnippet && String(f.name).toLowerCase().includes(String(activeBox.textSnippet).toLowerCase().slice(0,6)) && <span className="px-2 py-0.5 rounded-full bg-amber-400 text-white text-caption font-bold shrink-0">● Highlighted</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {grouped.conditions.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold font-sans text-caption text-amber-700 uppercase tracking-wider border-b border-amber-100 pb-1">Conditions</h4>
                      <ul className="space-y-1.5">
                        {grouped.conditions.map((f: any) => (
                          <li key={f.id} className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-body-sm text-amber-900">{f.name} — {f.plainExplanation || String(f.value || '').slice(0, 100)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {grouped.others.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold font-sans text-caption text-slate-700 uppercase tracking-wider border-b border-canvas-border pb-1">Other Extracted Details</h4>
                  <div className="space-y-1.5">
                    {grouped.others.map((f: any) => (
                      <div key={f.id} className="p-2.5 rounded-xl bg-canvas-muted border border-canvas-border text-body-sm">
                        <div className="flex items-center gap-2"><span className="text-caption font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-canvas-border text-muted">{f.category}</span><span className="font-semibold text-slate-900 truncate">{f.name}</span></div>
                        <p className="text-muted mt-1 line-clamp-2">{f.plainExplanation || String(f.value || '').slice(0, 120)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-canvas-border text-caption text-muted text-center">
                Grounded facts for <span className="font-mono font-semibold text-slate-700">{displayFileName}</span> • {factsForDoc.length} verified spans • Tap a Source badge in records to jump here
              </div>
            </div>
          )}

          {/* Bounding Box Overlay */}
          {activeBox && activeDocId && (
            <div
              className="absolute pointer-events-none rounded-md border-2 border-amber-400 bg-amber-400/15 shadow-lg shadow-amber-400/20 transition-all duration-300"
              style={{
                top: `${Math.max(0, Math.min(100, activeBox.y * 100))}%`,
                left: `${Math.max(0, Math.min(100, activeBox.x * 100))}%`,
                width: `${Math.max(2, Math.min(100, activeBox.width * 100))}%`,
                height: `${Math.max(2, Math.min(100, activeBox.height * 100))}%`,
              }}
            >
              <div className="absolute -top-6 left-0 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-sky-500 text-white font-sans font-bold text-caption px-2 py-0.5 rounded-lg shadow-md whitespace-nowrap">
                <Sparkles className="w-3 h-3 text-white" />
                <span>Verified source</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {activeBox && (
        <div className="mt-3 p-3 bg-canvas-muted rounded-xl border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted whitespace-nowrap">Verbatim:</span>
            <span className="font-mono text-primary-text font-medium truncate">"{activeBox.textSnippet || 'highlighted span'}"</span>
          </div>
          <span className="text-caption text-muted font-mono whitespace-nowrap">
            X {Math.round(activeBox.x * 100)}% Y {Math.round(activeBox.y * 100)}% • {displayFileName}
          </span>
        </div>
      )}
    </div>
  );
};
