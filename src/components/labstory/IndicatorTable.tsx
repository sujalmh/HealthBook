import React, { useState, useMemo } from 'react';
import { Activity, Database, Pin, TrendingUp, TrendingDown, Info, X, Calendar, Eye } from 'lucide-react';
import { BiomarkerChart, ZoomWindow } from './BiomarkerChart';
import { ModalPortal } from '../common/ModalPortal';
import type { LabRecord } from '@/types/vault';

// Mirrors LocalVault.ts:62-86 LOCAL_BIOMARKER_STANDARDS + findLocalStandard for vault-normalized dedup
const LOCAL_BIOMARKER_STANDARDS: Record<string, { canonicalName: string; standardUnit: string; refRange: { low: number; high: number }; optimalRange: { low: number; high: number }; criticalLow?: number; criticalHigh?: number }> = {
  creatinine: { canonicalName: 'Creatinine', standardUnit: 'mg/dL', refRange: { low: 0.6, high: 1.2 }, optimalRange: { low: 0.7, high: 1.0 }, criticalHigh: 3.0 },
  egfr: { canonicalName: 'eGFR', standardUnit: 'mL/min/1.73m2', refRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, criticalLow: 15 },
  hba1c: { canonicalName: 'HbA1c', standardUnit: '%', refRange: { low: 4.0, high: 5.6 }, optimalRange: { low: 4.5, high: 5.4 }, criticalHigh: 10.0 },
  'glucose fasting': { canonicalName: 'Glucose Fasting', standardUnit: 'mg/dL', refRange: { low: 70, high: 99 }, optimalRange: { low: 75, high: 90 }, criticalLow: 50, criticalHigh: 250 },
  potassium: { canonicalName: 'Potassium', standardUnit: 'mEq/L', refRange: { low: 3.5, high: 5.0 }, optimalRange: { low: 3.8, high: 4.6 }, criticalLow: 2.8, criticalHigh: 6.0 },
  'cholesterol total': { canonicalName: 'Cholesterol Total', standardUnit: 'mg/dL', refRange: { low: 125, high: 200 }, optimalRange: { low: 140, high: 180 }, criticalHigh: 300 },
  ldl: { canonicalName: 'LDL', standardUnit: 'mg/dL', refRange: { low: 50, high: 100 }, optimalRange: { low: 50, high: 80 }, criticalHigh: 190 },
  hdl: { canonicalName: 'HDL', standardUnit: 'mg/dL', refRange: { low: 40, high: 80 }, optimalRange: { low: 50, high: 80 }, criticalLow: 25 },
  triglycerides: { canonicalName: 'Triglycerides', standardUnit: 'mg/dL', refRange: { low: 50, high: 150 }, optimalRange: { low: 60, high: 100 }, criticalHigh: 500 },
};

function findLocalStandard(markerName: string) {
  const m = (markerName ?? '').toLowerCase().trim();
  if (m.includes('creat')) return LOCAL_BIOMARKER_STANDARDS['creatinine'];
  if (m.includes('egfr') || m.includes('gfr')) return LOCAL_BIOMARKER_STANDARDS['egfr'];
  if (m.includes('hba1c') || m.includes('a1c')) return LOCAL_BIOMARKER_STANDARDS['hba1c'];
  if (m.includes('glucose') || m.includes('glu')) return LOCAL_BIOMARKER_STANDARDS['glucose fasting'];
  if (m.includes('potassium') || m === 'k' || m === 'k+') return LOCAL_BIOMARKER_STANDARDS['potassium'];
  if (m.includes('ldl')) return LOCAL_BIOMARKER_STANDARDS['ldl'];
  if (m.includes('hdl')) return LOCAL_BIOMARKER_STANDARDS['hdl'];
  if (m.includes('triglyceride')) return LOCAL_BIOMARKER_STANDARDS['triglycerides'];
  if (m.includes('cholesterol')) return LOCAL_BIOMARKER_STANDARDS['cholesterol total'];
  return null;
}

// Clinical groupings — related markers read together (e.g. Kidney = Creatinine + eGFR)
const CATEGORY_ORDER = ['Kidney', 'Blood Sugar', 'Cholesterol', 'Electrolytes', 'Other'] as const;
function categoryFor(canonical: string): (typeof CATEGORY_ORDER)[number] {
  const m = canonical.toLowerCase();
  if (m.includes('creat') || m.includes('gfr')) return 'Kidney';
  if (m.includes('glucose') || m.includes('a1c')) return 'Blood Sugar';
  if (m.includes('cholesterol') || m.includes('ldl') || m.includes('hdl') || m.includes('triglyceride')) return 'Cholesterol';
  if (m.includes('potassium') || m === 'k' || m === 'k+' || m.includes('sodium')) return 'Electrolytes';
  return 'Other';
}

// How each test is best performed — practical prep guidance, one line per marker
const BEST_DONE_AS: Record<string, string> = {
  Creatinine: 'Blood draw — no fasting',
  eGFR: 'Blood draw — no fasting',
  HbA1c: 'Blood draw — no fasting',
  'Glucose Fasting': 'Blood draw — fast 8–12 h first',
  'Cholesterol Total': 'Blood draw — fasting preferred',
  LDL: 'Blood draw — fasting preferred',
  HDL: 'Blood draw — fasting preferred',
  Triglycerides: 'Blood draw — fast 9–12 h first',
  Potassium: 'Blood draw — no fasting',
};
function bestDoneAs(canonical: string): string {
  return BEST_DONE_AS[canonical] || 'Blood draw';
}

interface IndicatorTableProps {
  labs: LabRecord[];
  selectedMarker?: string;
  onMarkerSelect?: (marker: string) => void;
  className?: string;
}

export const IndicatorTable: React.FC<IndicatorTableProps> = ({ labs, selectedMarker, onMarkerSelect, className = '' }) => {
  const [activeDetailKey, setActiveDetailKey] = useState<string | null>(null);
  const [detailZoom, setDetailZoom] = useState<ZoomWindow>('5Y');
  const [detailShowRef, setDetailShowRef] = useState(true);
  const [detailShowOpt, setDetailShowOpt] = useState(true);

  // Deduplicated groups — vault-normalized lowercased via findLocalStandard
  const groups = useMemo(() => {
    const map = new Map<string, LabRecord[]>();
    labs.forEach((lab) => {
      const std = findLocalStandard(lab.marker ?? '');
      const canonical = std ? std.canonicalName : (lab.marker || 'Lab Marker');
      const key = canonical.toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lab);
    });
    const result = Array.from(map.entries()).map(([key, groupLabs]) => {
      const sorted = [...groupLabs].sort((a, b) => new Date(a.drawDate ?? 0).getTime() - new Date(b.drawDate ?? 0).getTime());
      const latest = sorted[sorted.length - 1];
      const std = findLocalStandard(latest.marker ?? '');
      const canonical = std ? std.canonicalName : latest.marker;
      // Derive flag/status via vault logic: use latest's flag/isBorderline/isCritical already normalized by LocalVault 120-125
      const flag = (latest.flag as unknown as string) || (latest.isBorderline ? 'BORDERLINE' : 'NORMAL');
      return {
        key,
        canonical,
        category: categoryFor(canonical),
        method: bestDoneAs(canonical),
        labs: sorted,
        latest,
        count: groupLabs.length,
        flag,
        isBorderline: !!latest.isBorderline,
        isCritical: !!latest.isCritical,
        referenceRange: latest.referenceRange,
        optimalRange: latest.optimalRange,
        unit: latest.normalizedUnit ?? latest.unit ?? '',
        value: latest.normalizedValue ?? latest.value,
      };
    });
    // group by category (clinical reading order), alphabetical within each group
    const catIndex = (c: string) => CATEGORY_ORDER.indexOf(c as (typeof CATEGORY_ORDER)[number]);
    result.sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.canonical.localeCompare(b.canonical));
    return result;
  }, [labs]);

  const activeGroup = useMemo(() => {
    if (!activeDetailKey) return null;
    return groups.find((g) => g.key === activeDetailKey) || null;
  }, [groups, activeDetailKey]);

  const handleRowClick = (group: typeof groups[number]) => {
    // sync selectedMarker for chart linking
    if (onMarkerSelect) onMarkerSelect(group.canonical);
    setActiveDetailKey(group.key);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, group: typeof groups[number]) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(group);
    }
  };

  // Plain explanation helper — uses flag/isBorderline/isCritical per LocalVault 120-125
  const plainExplanationFor = (g: typeof groups[number]) => {
    const v = g.value;
    const u = g.unit;
    const ref = g.referenceRange;
    const opt = g.optimalRange;
    let statusText = '';
    if (g.isCritical) {
      statusText = g.flag === 'CRITICAL_HIGH' ? 'critically high — needs immediate attention' : g.flag === 'CRITICAL_LOW' ? 'critically low — needs immediate attention' : 'critical';
    } else if (g.flag === 'HIGH') statusText = 'above the reference range (high)';
    else if (g.flag === 'LOW') statusText = 'below the reference range (low)';
    else if (g.isBorderline) statusText = 'near the edge of normal (borderline) — watch closely';
    else if (g.flag === 'BORDERLINE') statusText = 'borderline — close to the limit';
    else statusText = 'within the normal reference range';
    return `Your ${g.canonical} is ${v} ${u} — ${statusText}. Reference ${ref.low}–${ref.high} ${u}, optimal ${opt.low}–${opt.high} ${u}.`;
  };

  if (labs.length === 0) {
    return (
      <div className={`bg-canvas-card border border-dashed border-canvas-border rounded-2xl p-6 text-center ${className}`}>
        <p className="text-body-sm text-muted">No lab records yet — add past results to see your indicators here.</p>
      </div>
    );
  }

  return (
    <div className={`bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary-light border border-primary-border text-primary shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-heading-md font-bold text-slate-900 tracking-tight truncate">
              Indicators — {groups.length} unique • {labs.length} draws
            </h3>
            <p className="text-caption text-muted leading-snug">
              Your blood tests, grouped by what they check. Tap any row for history, trend chart, and your doctor's note.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 scrollbar-none">
        <table className="w-full text-left text-body-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-canvas-border text-caption text-muted uppercase tracking-wider">
              <th className="py-2.5 px-3 font-semibold">Biomarker</th>
              <th className="py-2.5 px-3 font-semibold">Latest Value</th>
              <th className="py-2.5 px-3 font-semibold">Reference</th>
              <th className="py-2.5 px-3 font-semibold">Best Done As</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th className="py-2.5 px-3 font-semibold">Last Draw</th>
              <th className="py-2.5 px-3 font-semibold">History</th>
            </tr>
          </thead>
          {CATEGORY_ORDER.map((category) => {
            const catGroups = groups.filter((g) => g.category === category);
            if (catGroups.length === 0) return null;
            return (
              <tbody key={category} className="divide-y divide-canvas-border text-slate-700 font-medium">
                <tr className="bg-canvas-muted/60">
                  <th colSpan={7} scope="colgroup" className="py-1.5 px-3 text-left text-caption font-semibold uppercase tracking-wider text-slate-600">
                    {category}
                  </th>
                </tr>
                {catGroups.map((g) => {
                const isSelected = (selectedMarker ?? '').toLowerCase().trim() === g.canonical.toLowerCase().trim();
                const dotColor = g.isCritical
                  ? 'bg-rose-500'
                  : g.isBorderline
                  ? 'bg-amber-500'
                  : g.flag === 'HIGH' || g.flag === 'LOW' || g.flag === 'BORDERLINE'
                  ? 'bg-amber-400'
                  : 'bg-emerald-500';
                const badgeClass = g.isCritical
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : g.isBorderline || g.flag === 'HIGH' || g.flag === 'LOW' || g.flag === 'BORDERLINE'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                return (
                  <tr
                    key={g.key}
                    onClick={() => handleRowClick(g)}
                    onKeyDown={(e) => handleRowKeyDown(e, g)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${g.canonical} ${g.value} ${g.unit} ${g.flag}${g.isBorderline ? ' borderline' : ''}${g.isCritical ? ' critical' : ''} — tap for details`}
                    className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px] ${isSelected ? 'bg-primary-light/50 hover:bg-primary-light/60' : 'hover:bg-canvas-muted/60'}`}
                    style={{ height: '44px' }}
                  >
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        {g.canonical}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {g.value as string | number} <span className="font-normal text-muted text-caption">{g.unit}</span>
                    </td>
                    <td className="py-3 px-3 text-muted text-body-sm whitespace-nowrap">
                      {g.referenceRange?.low ?? 0}–{g.referenceRange?.high ?? 100} {g.unit}
                    </td>
                    <td className="py-3 px-3 text-body-sm text-slate-600">
                      {g.method}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-caption px-2 py-0.5 rounded-full font-bold uppercase border whitespace-nowrap ${badgeClass}`}>
                        {g.flag}
                        {g.isBorderline && g.flag !== 'BORDERLINE' ? ' • BORDERLINE' : ''}
                        {g.isCritical ? ' • CRITICAL' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-900 font-medium">
                      {g.latest.drawDate ? new Date(g.latest.drawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-caption text-muted">
                        <Calendar className="w-3 h-3" /> {g.count} {g.count === 1 ? 'draw' : 'draws'}
                      </span>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Details drill-down: modal/sheet with value+ref+flag+history+chart+doctorComment+explanation */}
      {activeGroup && (
        <ModalPortal isOpen={!!activeGroup} onClose={() => setActiveDetailKey(null)} ariaLabel={`${activeGroup.canonical} details`}>
          <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto flex flex-col">
            <div className="sticky top-0 bg-canvas-card border-b border-canvas-border px-4 sm:px-6 py-4 flex items-start justify-between gap-3 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary-light border border-primary-border text-primary shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-heading-md font-bold text-slate-900 truncate">{activeGroup.canonical} — Details</h3>
                  <p className="text-caption text-muted">Latest value, ranges, trend chart, and history in one place.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailKey(null)}
                className="p-2.5 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-900 border border-transparent hover:border-canvas-border min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Latest value + unit + flag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-canvas-muted border border-canvas-border rounded-xl p-4 space-y-2">
                  <div className="text-caption font-bold uppercase tracking-wider text-muted">Latest Value</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono">
                    {activeGroup.value} <span className="text-base font-normal text-muted">{activeGroup.unit}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-caption px-2 py-1 rounded-full font-bold uppercase border ${activeGroup.isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' : activeGroup.isBorderline || activeGroup.flag !== 'NORMAL' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {activeGroup.flag}
                    </span>
                    {activeGroup.isBorderline && <span className="text-caption px-2 py-1 rounded-full font-bold border bg-amber-50 text-amber-700 border-amber-200">BORDERLINE</span>}
                    {activeGroup.isCritical && <span className="text-caption px-2 py-1 rounded-full font-bold border bg-rose-50 text-rose-700 border-rose-200">CRITICAL</span>}
                  </div>
                  <div className="text-caption text-muted">Last draw: {activeGroup.latest.drawDate ? new Date(activeGroup.latest.drawDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'} • {activeGroup.count} total draws</div>
                </div>

                <div className="bg-canvas-muted border border-canvas-border rounded-xl p-4 space-y-3">
                  <div className="text-caption font-bold uppercase tracking-wider text-muted flex items-center gap-1"><Info className="w-3 h-3" /> Ranges</div>
                  <div className="space-y-1.5 text-body-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Reference</span>
                      <span className="font-semibold text-slate-900">{activeGroup.referenceRange.low}–{activeGroup.referenceRange.high} {activeGroup.unit}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Optimal</span>
                      <span className="font-semibold text-emerald-700">{activeGroup.optimalRange.low}–{activeGroup.optimalRange.high} {activeGroup.unit}</span>
                    </div>
                    <div className="text-caption text-muted pt-1 border-t border-canvas-border">Reference = lab normal; Optimal = evidence-based target. Borderline ±10% buffer per vault.</div>
                  </div>
                </div>
              </div>

              {/* Plain explanation */}
              <div className="bg-white border border-canvas-border rounded-xl p-4">
                <div className="text-caption font-bold uppercase tracking-wider text-muted mb-1">What this means</div>
                <p className="text-body-sm text-slate-700 leading-relaxed">{plainExplanationFor(activeGroup)}</p>
              </div>

              {/* Doctor comment */}
              {(() => {
                const rec = activeGroup.latest as unknown as { doctorComment?: { doctorName: string; comment: string; timestamp?: string }; doctorComments?: { doctorName: string; comment: string; timestamp?: string }[] };
                const dc = rec.doctorComment || rec.doctorComments?.[0];
                if (!dc) return (
                  <div className="text-caption text-muted bg-canvas-muted border border-dashed border-canvas-border rounded-xl p-3">No clinician note pinned for this marker yet.</div>
                );
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-caption"><Pin className="w-3.5 h-3.5" /> Dr. Note — {dc.doctorName}</div>
                    <p className="text-body-sm text-slate-900 leading-snug">{dc.comment}</p>
                    <div className="text-caption text-muted">{dc.timestamp ? new Date(dc.timestamp).toLocaleDateString() : ''}</div>
                  </div>
                );
              })()}

              {/* BiomarkerChart trajectory embedded */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-muted"><Eye className="w-3 h-3" /> Trajectory</div>
                <BiomarkerChart
                  markerName={activeGroup.canonical}
                  labs={activeGroup.labs}
                  activeZoom={detailZoom}
                  onZoomChange={setDetailZoom}
                  showReferenceRange={detailShowRef}
                  showOptimalRange={detailShowOpt}
                  onToggleReferenceRange={setDetailShowRef}
                  onToggleOptimalRange={setDetailShowOpt}
                  embedded={false}
                  className="border border-canvas-border rounded-xl overflow-hidden"
                />
              </div>

              {/* Recent history — consolidated overview history lives here, not in main table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-caption font-bold uppercase tracking-wider text-muted flex items-center gap-1"><Calendar className="w-3 h-3" /> Recent history ({activeGroup.labs.length})</div>
                  <span className="text-caption text-muted">Draw → value → flag</span>
                </div>
                <div className="overflow-x-auto -mx-1 scrollbar-none border border-canvas-border rounded-xl">
                  <table className="w-full text-left text-body-sm min-w-[420px]">
                    <thead>
                      <tr className="border-b border-canvas-border bg-canvas-muted/50 text-caption text-muted uppercase tracking-wider">
                        <th className="py-2 px-3 font-semibold">Draw Date</th>
                        <th className="py-2 px-3 font-semibold">Value</th>
                        <th className="py-2 px-3 font-semibold">Flag</th>
                        <th className="py-2 px-3 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-canvas-border bg-white">
                      {[...activeGroup.labs].slice().sort((a, b) => new Date(b.drawDate ?? 0).getTime() - new Date(a.drawDate ?? 0).getTime()).map((r) => {
                        const rec = r as unknown as { doctorComment?: { comment: string }; doctorComments?: { comment: string }[] };
                        const dc = rec.doctorComment || rec.doctorComments?.[0];
                        return (
                          <tr key={r.id} className="hover:bg-canvas-muted/30">
                            <td className="py-2.5 px-3 whitespace-nowrap">{r.drawDate ? new Date(r.drawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                            <td className="py-2.5 px-3 font-mono font-bold">{r.normalizedValue ?? r.value} <span className="font-normal text-muted">{r.normalizedUnit ?? r.unit}</span></td>
                            <td className="py-2.5 px-3">
                              <span className={`text-caption px-2 py-0.5 rounded-full font-bold uppercase border ${r.isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' : r.isBorderline ? 'bg-amber-50 text-amber-700 border-amber-200' : r.flag === 'HIGH' || r.flag === 'LOW' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                {r.flag || (r.isBorderline ? 'BORDERLINE' : 'NORMAL')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-caption">{dc ? <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><Pin className="w-3 h-3" /> {dc.comment.slice(0, 40)}...</span> : <span className="text-muted">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={() => setActiveDetailKey(null)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
