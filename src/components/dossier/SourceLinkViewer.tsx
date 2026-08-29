import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import type { BoundingBox } from '@/types/vault';
import { eventBus } from '@/core/events/eventBus';

interface SourceLinkViewerProps {
  documentId?: string;
  fileName?: string;
  boundingBox?: BoundingBox | null;
  pageIndex?: number;
  snippetText?: string;
  onClose?: () => void;
  onSelectCitation?: (citationId: string) => void;
}

export const SourceLinkViewer: React.FC<SourceLinkViewerProps> = ({
  documentId = 'doc_discharge_cardiac_001',
  fileName = 'discharge_summary_cardiac_ward.pdf',
  boundingBox: propBox,
  pageIndex: propPage = 1,
  snippetText: propSnippet,
  onClose
}) => {
  const [activeDocId, setActiveDocId] = useState<string>(documentId);
  const [activeFileName, setActiveFileName] = useState<string>(fileName);
  const [activeBox, setActiveBox] = useState<BoundingBox | null>(propBox || null);
  const [currentPage, setCurrentPage] = useState<number>(propPage);
  const [zoom, setZoom] = useState<number>(1);
  const [snippet, setSnippet] = useState<string | undefined>(propSnippet);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const docWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propBox) {
      setActiveBox(propBox);
      if (propBox.pageIndex !== undefined) {
        setCurrentPage(propBox.pageIndex);
      }
    }
  }, [propBox]);

  useEffect(() => {
    if (documentId) setActiveDocId(documentId);
    if (fileName) setActiveFileName(fileName);
    if (propSnippet) setSnippet(propSnippet);
  }, [documentId, fileName, propSnippet]);

  // Listen to global highlight events
  useEffect(() => {
    const unsub = eventBus.onHighlightDocument((payload) => {
      if (payload.documentId) setActiveDocId(payload.documentId);
      if (payload.boundingBox) {
        setActiveBox(payload.boundingBox);
        if (payload.boundingBox.pageIndex !== undefined) {
          setCurrentPage(payload.boundingBox.pageIndex);
        }
      }
      setZoom(1.15);
      centerOnBox(payload.boundingBox);
    });
    return () => unsub();
  }, []);

  const centerOnBox = (box?: BoundingBox | null) => {
    if (!box || !containerRef.current) return;
    setTimeout(() => {
      if (!containerRef.current) return;
      // Calculate center coordinate
      const isNormalized = box.x <= 1 && box.y <= 1;
      const targetY = isNormalized ? box.y * 600 : (box.y / 800) * 600;
      containerRef.current.scrollTo({
        top: Math.max(0, targetY - 150),
        behavior: 'smooth'
      });
    }, 100);
  };

  const handleZoomIn = () => setZoom(z => Math.min(Number((z + 0.2).toFixed(1)), 2.5));
  const handleZoomOut = () => setZoom(z => Math.max(Number((z - 0.2).toFixed(1)), 0.6));
  const handleResetZoom = () => {
    setZoom(1);
    centerOnBox(activeBox);
  };

  const handleCopyCitation = () => {
    const text = snippet || (activeBox ? `Page ${currentPage}, BBox: [${activeBox.x}, ${activeBox.y}, ${activeBox.width}, ${activeBox.height}]` : activeFileName);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert bounding box coordinate to CSS style percentages
  const getBoxStyle = (box: BoundingBox): React.CSSProperties => {
    // If coordinates are <= 1, they are normalized (0.0 - 1.0)
    // If coordinates are > 1, they are pixel/point based on a standard 800x1000 page
    const isNormalized = box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;
    const left = isNormalized ? `${box.x * 100}%` : `${(box.x / 750) * 100}%`;
    const top = isNormalized ? `${box.y * 100}%` : `${(box.y / 900) * 100}%`;
    const width = isNormalized ? `${box.width * 100}%` : `${(box.width / 750) * 100}%`;
    const height = isNormalized ? `${box.height * 100}%` : `${(box.height / 900) * 100}%`;

    return {
      left,
      top,
      width,
      height
    };
  };

  return (
    <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col h-full text-slate-900 space-y-4">
      {/* Header with document title and zoom controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">{activeFileName}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Verified Ground Truth
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-mono">Doc ID: {activeDocId} • Page {currentPage} of 2</p>
          </div>
        </div>

        {/* Action Buttons: Page Nav, Zoom Controls, Close */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Page Switcher */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded-lg text-slate-600 hover:text-slate-800 disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-700">P.{currentPage}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(2, p + 1))}
              disabled={currentPage >= 2}
              className="p-1 rounded-lg text-slate-600 hover:text-slate-800 disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-slate-100 rounded text-slate-700 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-700 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-slate-100 rounded text-slate-700 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800 transition-colors ml-1 border-l border-slate-200"
              title="Reset Zoom & Center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Document Viewport — tokenized */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-canvas-muted rounded-xl border border-canvas-border p-6 min-h-[440px] max-h-[560px] relative flex justify-center items-start shadow-inner"
      >
        <div
          ref={docWrapperRef}
          className="relative bg-white text-slate-900 rounded-lg shadow-2xl transition-transform duration-300 origin-top p-8 font-serif text-[11px] leading-relaxed border border-slate-300 max-w-2xl w-full select-text"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {/* Document Content Render Based on Document Type */}
          {activeDocId.includes('nephrology') || activeFileName.includes('nephrology') ? (
            <div className="space-y-4">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="font-bold text-sm tracking-wider uppercase">REGIONAL NEPHROLOGY CLINIC</h1>
                  <p className="text-[10px] text-slate-600 font-sans">Specialist Consultation Note</p>
                </div>
                <div className="text-right text-[10px] text-slate-600 font-mono">
                  <div>Date: 2024-04-12</div>
                  <div>Attending: Dr. Chen, MD</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-100 p-2.5 rounded font-sans">
                <div><strong>Patient:</strong> Smt. Shanti Devi (78F)</div>
                <div><strong>MRN:</strong> MRN-984210</div>
                <div><strong>Primary Diagnosis:</strong> Chronic Kidney Disease</div>
                <div><strong>Stage:</strong> Stage 3b (eGFR 38-42)</div>
              </div>

              <div className="space-y-3 font-sans">
                <div>
                  <h4 className="font-bold text-[11px] text-slate-800 uppercase border-b border-slate-200 pb-0.5 mb-1">
                    CLINICAL ASSESSMENT & DIAGNOSIS
                  </h4>
                  <p className="text-slate-800 leading-normal">
                    Patient presents for longitudinal nephrology evaluation. Baseline serum creatinine 1.45 mg/dL with corresponding eGFR 40 mL/min/1.73m2. Confirmed diagnosis of <strong>Chronic Kidney Disease Stage 3b</strong> (baseline eGFR 38-42 mL/min).
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-[11px] text-slate-800 uppercase border-b border-slate-200 pb-0.5 mb-1">
                    RENAL PRESERVATION PLAN & MEDICATION DIRECTIVES
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    <li>Avoid all NSAIDs (Ibuprofen, Naproxen, Ketorolac) due to acute renal hemodynamics risk.</li>
                    <li>Continue ACE-inhibitor (Lisinopril) with bi-annual renal panel monitoring.</li>
                    <li>Tight glycemic control with Metformin (monitor eGFR threshold &lt; 30).</li>
                    <li>Target blood pressure &lt; 130/80 mmHg.</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : activeDocId.includes('homelab') || activeFileName.includes('homelab') ? (
            <div className="space-y-4">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="font-bold text-sm tracking-wider uppercase">METROPOLIS HEALTHCARE</h1>
                  <p className="text-[10px] text-slate-600 font-sans">Remote Specimen Collection & Rapid Biomarker Slip</p>
                </div>
                <div className="text-right text-[10px] text-slate-600 font-mono">
                  <div>Draw: 2026-08-28 08:30</div>
                  <div>Specimen ID: MET-902381</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-100 p-2.5 rounded font-sans">
                <div><strong>Patient:</strong> Smt. Shanti Devi (78F)</div>
                <div><strong>Collection Type:</strong> Home Phlebotomy Kit</div>
              </div>

              <div className="space-y-3 font-mono text-[11px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-left text-[10px] text-slate-600 uppercase font-sans">
                      <th className="py-1">Biomarker Test</th>
                      <th className="py-1">Result</th>
                      <th className="py-1">Reference Range</th>
                      <th className="py-1">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-1 font-bold">Serum Creatinine</td>
                      <td className="py-1 text-rose-700 font-bold">1.90 mg/dL</td>
                      <td className="py-1 text-slate-600">0.60 - 1.20 mg/dL</td>
                      <td className="py-1 font-bold text-rose-600">[HIGH]</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold">eGFR (CKD-EPI 2021)</td>
                      <td className="py-1 text-rose-700 font-bold">28 mL/min/1.73m2</td>
                      <td className="py-1 text-slate-600">&gt; 60 mL/min/1.73m2</td>
                      <td className="py-1 font-bold text-rose-700">[CRITICAL LOW]</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold">Serum Potassium (K+)</td>
                      <td className="py-1 text-emerald-700 font-bold">4.8 mEq/L</td>
                      <td className="py-1 text-slate-600">3.5 - 5.1 mEq/L</td>
                      <td className="py-1 text-emerald-600">[NORMAL]</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold">Fasting Glucose</td>
                      <td className="py-1 text-amber-700 font-bold">140 mg/dL</td>
                      <td className="py-1 text-slate-600">70 - 99 mg/dL</td>
                      <td className="py-1 font-bold text-amber-600">[HIGH]</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Default: Metropolitan Cardiac Institute Discharge Summary */
            <div className="space-y-4">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="font-bold text-sm tracking-wider uppercase">METROPOLITAN CARDIAC INSTITUTE</h1>
                  <p className="text-[10px] text-slate-600 font-sans">Inpatient Discharge Summary & Reconciliation Orders</p>
                </div>
                <div className="text-right text-[10px] text-slate-600 font-mono">
                  <div>Discharge: 2026-08-25</div>
                  <div>MRN: MRN-984210</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-100 p-2.5 rounded font-sans">
                <div><strong>Patient:</strong> Smt. Shanti Devi (78F)</div>
                <div><strong>Attending:</strong> Dr. A. Patel, MD, FACC</div>
                <div><strong>Admission:</strong> 2026-08-20</div>
                <div><strong>Discharge:</strong> 2026-08-25</div>
              </div>

              {currentPage === 1 ? (
                <div className="space-y-3 font-sans">
                  <div>
                    <h4 className="font-bold text-[11px] text-slate-800 uppercase border-b border-slate-200 pb-0.5 mb-1">
                      FINAL DISCHARGE MEDICATIONS
                    </h4>
                    <div className="space-y-1.5 text-[10px] text-slate-800">
                      <p>1. <strong>Apixaban (Eliquis) 5 mg PO BID</strong> (08:00, 20:00) — New stroke prophylaxis for Non-valvular Atrial Fibrillation.</p>
                      <p>2. <strong>Metformin 1000 mg PO BID with meals</strong> (08:00, 18:00) — Dose increased from home 500mg.</p>
                      <p>3. <strong>Atorvastatin 40 mg PO QHS</strong> (22:00) — Post-PCI stabilization. Avoid grapefruit.</p>
                      <p>4. <strong>Lisinopril 20 mg PO Daily</strong> — <span className="text-rose-700 font-bold">DISCONTINUED / HELD</span> due to acute renal strain.</p>
                      <p>5. <strong>Levothyroxine 75 mcg PO QAM</strong> (07:30) — Continued daily on empty stomach.</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-[11px] text-slate-800 uppercase border-b border-slate-200 pb-0.5 mb-1">
                      DISCHARGE BIOMARKERS & VITALS
                    </h4>
                    <div className="font-mono text-[10px] space-y-0.5 text-slate-800">
                      <p>• BP: 128/78 mmHg | HR: 72 bpm (Normal Sinus Rhythm post-cardioversion)</p>
                      <p>• Serum Creatinine: 1.80 mg/dL (Elevated, baseline 1.30)</p>
                      <p>• eGFR: 32 mL/min/1.73m2 (CKD Stage 3b acute strain)</p>
                      <p>• Serum Potassium: 4.9 mEq/L</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 font-sans">
                  <div>
                    <h4 className="font-bold text-[11px] text-slate-800 uppercase border-b border-slate-200 pb-0.5 mb-1">
                      DISCHARGE ORDERS & PRESCRIBED CADENCE
                    </h4>
                    <div className="space-y-1.5 text-[10px] text-slate-800">
                      <p>• Repeat Serum Creatinine and Electrolytes in 2 weeks with local HomeLab.</p>
                      <p>• Cardiology Clinic follow-up appointment in 4 weeks.</p>
                      <p>• Emergency precautions: report sudden pedal swelling, dyspnea, or dizziness immediately.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Animated Gold & Sky Bounding Box Highlight */}
          {activeBox && (!activeBox.pageIndex || activeBox.pageIndex === currentPage) && (
            <div
              className="absolute pointer-events-none rounded-md transition-all duration-300 border-2 border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/30 animate-pulse"
              style={getBoxStyle(activeBox)}
            >
              <div className="absolute -top-7 left-0 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-sky-500 text-slate-900 font-sans font-black text-[9px] px-2 py-0.5 rounded shadow-md whitespace-nowrap">
                <Sparkles className="w-3 h-3 text-slate-900" />
                <span>Source ground truth highlight</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Verbatim text span and Bounding Box Citation — tokenized */}
      <div className="bg-canvas-muted rounded-xl p-4 border border-canvas-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-body-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Crosshair className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Verbatim Citation:</span>
              {activeBox && (
                <span className="font-mono text-[10px] text-slate-600">
                  [P.{currentPage} x:{activeBox.x}, y:{activeBox.y}, w:{activeBox.width}, h:{activeBox.height}]
                </span>
              )}
            </div>
            <p className="font-mono text-sky-700 font-medium text-[11px] line-clamp-2">
              "{snippet || activeBox?.textSnippet || 'Clinical fact grounded in verified source document.'}"
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyCitation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Citation'}</span>
        </button>
      </div>
    </div>
  );
};
