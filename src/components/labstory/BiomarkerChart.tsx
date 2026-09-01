import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Activity,
  Pin,
  Calendar,
  Layers,
  Info,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  PlusCircle,
  X
} from 'lucide-react';
import type { LabRecord } from '@/types/vault';

export type ZoomWindow = '30D' | '90D' | '1Y' | '3Y' | '5Y' | 'MAX';

interface BiomarkerChartProps {
  markerName: string;
  labs: LabRecord[];
  activeZoom: ZoomWindow;
  onZoomChange: (zoom: ZoomWindow) => void;
  showReferenceRange: boolean;
  showOptimalRange: boolean;
  onToggleReferenceRange: (show: boolean) => void;
  onToggleOptimalRange: (show: boolean) => void;
  onPointSelect?: (point: LabRecord) => void;
  onAddDoctorComment?: (labId: string, comment: string) => void;
  causalHighlightWindow?: { start: string; end: string; label?: string } | null;
  className?: string;
  embedded?: boolean;
}

export const BiomarkerChart: React.FC<BiomarkerChartProps> = ({
  markerName,
  labs,
  activeZoom,
  onZoomChange,
  showReferenceRange,
  showOptimalRange,
  onToggleReferenceRange,
  onToggleOptimalRange,
  onPointSelect,
  onAddDoctorComment,
  causalHighlightWindow,
  className = '',
  embedded = false
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<LabRecord | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<LabRecord | null>(null);
  const [activeDoctorPin, setActiveDoctorPin] = useState<{ lab: LabRecord; comment: any } | null>(null);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // Measure container width dynamically for crisp responsive SVG rendering
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) setContainerWidth(Math.round(w));
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  // Filter labs according to active zoom
  const filteredLabs = useMemo(() => {
    if (!labs || labs.length === 0) return [];
    const sorted = [...labs].sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());
    if (activeZoom === 'MAX') return sorted;

    const latestEpoch = new Date(sorted[sorted.length - 1].drawDate).getTime();
    let cutoffMs = 0;
    if (activeZoom === '30D') cutoffMs = 30 * 24 * 60 * 60 * 1000;
    else if (activeZoom === '90D') cutoffMs = 90 * 24 * 60 * 60 * 1000;
    else if (activeZoom === '1Y') cutoffMs = 365 * 24 * 60 * 60 * 1000;
    else if (activeZoom === '3Y') cutoffMs = 3 * 365 * 24 * 60 * 60 * 1000;
    else if (activeZoom === '5Y') cutoffMs = 5 * 365 * 24 * 60 * 60 * 1000;

    const windowStart = latestEpoch - cutoffMs;
    const windowFiltered = sorted.filter((l) => new Date(l.drawDate).getTime() >= windowStart);
    // If window filters out everything except 1, provide at least 2 points if available
    return windowFiltered.length >= 2 ? windowFiltered : sorted.slice(-3);
  }, [labs, activeZoom]);

  // Dimension & Scaling Calculations adapted to container
  const isMobile = containerWidth < 600;
  const chartWidth = Math.max(containerWidth, 280);
  const chartHeight = isMobile ? 260 : 340;
  const padding = isMobile
    ? { top: 28, right: 18, bottom: 36, left: 46 }
    : { top: 40, right: 40, bottom: 45, left: 60 };
  const innerWidth = Math.max(10, chartWidth - padding.left - padding.right);
  const innerHeight = Math.max(10, chartHeight - padding.top - padding.bottom);

  const { minX, maxX, minY, maxY, refRange, optRange, unit } = useMemo(() => {
    if (filteredLabs.length === 0) {
      return {
        minX: Date.now() - 365 * 24 * 3600 * 1000,
        maxX: Date.now(),
        minY: 0,
        maxY: 100,
        refRange: { low: 10, high: 90 },
        optRange: { low: 20, high: 80 },
        unit: 'units'
      };
    }

    const times = filteredLabs.map((l) => new Date(l.drawDate).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    // Add small 5% buffer on X
    const spanT = Math.max(maxT - minT, 24 * 3600 * 1000);
    const minXVal = minT - spanT * 0.04;
    const maxXVal = maxT + spanT * 0.04;

    const sample = filteredLabs[0];
    const ref = sample.referenceRange || { low: 0, high: 100 };
    const opt = sample.optimalRange || { low: ref.low, high: ref.high * 0.85 };

    const values = filteredLabs.map((l) => l.normalizedValue);
    const allYValues = [...values, ref.low, ref.high, opt.low, opt.high].filter((v) => typeof v === 'number' && !isNaN(v));

    const rawMinY = Math.min(...allYValues);
    const rawMaxY = Math.max(...allYValues);
    const spanY = Math.max(rawMaxY - rawMinY, 1);
    const minYVal = Math.max(0, Math.floor(rawMinY - spanY * 0.18));
    const maxYVal = Math.ceil(rawMaxY + spanY * 0.22);

    return {
      minX: minXVal,
      maxX: maxXVal,
      minY: minYVal,
      maxY: maxYVal,
      refRange: ref,
      optRange: opt,
      unit: sample.normalizedUnit || sample.unit || ''
    };
  }, [filteredLabs]);

  const scaleX = (epoch: number) => padding.left + ((epoch - minX) / (maxX - minX)) * innerWidth;
  const scaleY = (val: number) => padding.top + innerHeight - ((val - minY) / (maxY - minY)) * innerHeight;

  // Build SVG Path Line with smooth cubic or straight segments
  const pathD = useMemo(() => {
    if (filteredLabs.length === 0) return '';
    const points = filteredLabs.map((l) => ({
      x: scaleX(new Date(l.drawDate).getTime()),
      y: scaleY(l.normalizedValue)
    }));

    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      // Catmull-Rom to Cubic Bezier conversion
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [filteredLabs, minX, maxX, minY, maxY, padding.left, innerWidth, padding.top, innerHeight]);

  // Y-Axis Ticks
  const yTicks = useMemo(() => {
    const ticksCount = isMobile ? 4 : 5;
    const step = (maxY - minY) / ticksCount;
    const ticks: number[] = [];
    for (let i = 0; i <= ticksCount; i++) {
      const val = minY + step * i;
      ticks.push(Number(val.toFixed(val < 5 ? 2 : 1)));
    }
    return ticks;
  }, [minY, maxY, isMobile]);

  // X-Axis Ticks with decimation on narrow screens to prevent overlap
  const xTicks = useMemo(() => {
    if (filteredLabs.length === 0) return [];
    const all = filteredLabs.map((l) => ({
      epoch: new Date(l.drawDate).getTime(),
      label: new Date(l.drawDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      fullDate: new Date(l.drawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }));

    if (all.length <= 3) return all;

    if (isMobile) {
      const first = all[0];
      const last = all[all.length - 1];
      const mid = all[Math.floor(all.length / 2)];
      return [first, mid, last];
    }
    return all;
  }, [filteredLabs, isMobile]);

  const handlePointClick = (pt: LabRecord) => {
    setSelectedPoint(pt);
    if (onPointSelect) onPointSelect(pt);

    // If point has doctor comments, highlight the primary pin
    if (pt.doctorComment || (pt.doctorComments && pt.doctorComments.length > 0)) {
      const comment = pt.doctorComment || pt.doctorComments![0];
      setActiveDoctorPin({ lab: pt, comment });
    }
  };

  const handleSaveDoctorComment = () => {
    if (!newCommentText.trim() || !selectedPoint) return;
    if (onAddDoctorComment) {
      onAddDoctorComment(selectedPoint.id, newCommentText);
    }
    setNewCommentText('');
    setIsAddingComment(false);
  };

  const zoomOptions: ZoomWindow[] = ['30D', '90D', '1Y', '3Y', '5Y', 'MAX'];

  const outerClass = embedded
    ? `${className}`
    : `bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`;

  return (
    <div className={outerClass}>
      {/* Top Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-light border border-primary-border text-primary shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-heading-md font-bold text-slate-900 flex items-center gap-2 tracking-tight">
              <span>{markerName}</span>
              <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-muted-subtle text-muted border border-canvas-border">
                {unit}
              </span>
            </h3>
            <p className="text-body-sm text-muted leading-relaxed">
              Your results over time. Tap a dot to see details.
            </p>
          </div>
        </div>

        {/* Right Controls: Range Toggles & Zoom Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
          {/* Dual Range Toggles (LS5) with >=44px Touch Targets */}
          <div className="flex items-center gap-1.5 bg-canvas-muted border border-canvas-border rounded-xl p-1 text-body-sm w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onToggleReferenceRange(!showReferenceRange)}
              className={`min-h-[44px] px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                showReferenceRange ? 'bg-canvas-card text-slate-900 shadow-sm border border-canvas-border' : 'text-muted hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-muted inline-block shrink-0" />
              <span className="text-caption sm:text-body-sm whitespace-nowrap">Ref ({refRange.low}–{refRange.high})</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleOptimalRange(!showOptimalRange)}
              className={`min-h-[44px] px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                showOptimalRange ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' : 'text-muted hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span className="text-caption sm:text-body-sm whitespace-nowrap">Optimal ({optRange.low}–{optRange.high})</span>
            </button>
          </div>

          {/* Zoom Window Filter (LS2) with >=44px Touch Targets */}
          <div className="flex items-center gap-1 bg-canvas-muted border border-canvas-border rounded-xl p-1 text-body-sm overflow-x-auto scrollbar-none w-full sm:w-auto max-w-full">
            {zoomOptions.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => onZoomChange(z)}
                className={`min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-lg font-bold transition-colors flex items-center justify-center flex-1 sm:flex-initial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  activeZoom === z ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-slate-900'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Canvas Area Container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl bg-canvas-muted border border-canvas-border"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto select-none block overflow-visible"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="refRangeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.04" />
            </linearGradient>

            <linearGradient id="optRangeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.06" />
            </linearGradient>

            <linearGradient id="lineGlowGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>

            <linearGradient id="causalWindowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Background Grid Lines */}
          {yTicks.map((tickVal) => {
            const y = scaleY(tickVal);
            return (
              <g key={`ytick_${tickVal}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* 2. Causal Highlight Window Overlay (LS3) */}
          {causalHighlightWindow && (
            <g className="animate-pulse">
              <rect
                x={Math.max(padding.left, scaleX(new Date(causalHighlightWindow.start).getTime()))}
                y={padding.top}
                width={Math.max(
                  30,
                  scaleX(new Date(causalHighlightWindow.end).getTime()) -
                    scaleX(new Date(causalHighlightWindow.start).getTime())
                )}
                height={innerHeight}
                fill="url(#causalWindowGrad)"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                rx="4"
              />
              <text
                x={scaleX(new Date(causalHighlightWindow.start).getTime()) + 8}
                y={padding.top + 16}
                fill="#fbbf24"
                fontSize="11"
                fontWeight="bold"
              >
                ⚡ Causal Window: {causalHighlightWindow.label || 'Drug Interaction Shift'}
              </text>
            </g>
          )}

          {/* 3. Reference Range Shaded Polygon (LS5) */}
          {showReferenceRange && (
            <g>
              <rect
                x={padding.left}
                y={scaleY(refRange.high)}
                width={innerWidth}
                height={Math.max(2, scaleY(refRange.low) - scaleY(refRange.high))}
                fill="url(#refRangeGrad)"
              />
              <line
                x1={padding.left}
                y1={scaleY(refRange.high)}
                x2={chartWidth - padding.right}
                y2={scaleY(refRange.high)}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="6 3"
                opacity="0.6"
              />
              <line
                x1={padding.left}
                y1={scaleY(refRange.low)}
                x2={chartWidth - padding.right}
                y2={scaleY(refRange.low)}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="6 3"
                opacity="0.6"
              />
              <text
                x={chartWidth - padding.right - 6}
                y={scaleY(refRange.high) - 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="11"
                fontWeight="bold"
              >
                Ref High: {refRange.high}
              </text>
            </g>
          )}

          {/* 4. Optimal Longevity Range Shaded Polygon (LS5) */}
          {showOptimalRange && (
            <g>
              <rect
                x={padding.left}
                y={scaleY(optRange.high)}
                width={innerWidth}
                height={Math.max(2, scaleY(optRange.low) - scaleY(optRange.high))}
                fill="url(#optRangeGrad)"
              />
              <line
                x1={padding.left}
                y1={scaleY(optRange.high)}
                x2={chartWidth - padding.right}
                y2={scaleY(optRange.high)}
                stroke="#10b981"
                strokeWidth="1.2"
                strokeDasharray="4 2"
                opacity="0.8"
              />
              <text
                x={chartWidth - padding.right - 6}
                y={scaleY(optRange.high) + 14}
                textAnchor="end"
                fill="#34d399"
                fontSize="11"
                fontWeight="bold"
              >
                Optimal Target: {optRange.low}–{optRange.high}
              </text>
            </g>
          )}

          {/* 5. Biomarker Trajectory Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#lineGlowGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />

          {/* 6. X-Axis Dates */}
          {xTicks.map((xt, i) => {
            const x = scaleX(xt.epoch);
            return (
              <g key={`xtick_${xt.epoch}_${i}`}>
                <line x1={x} y1={padding.top + innerHeight} x2={x} y2={padding.top + innerHeight + 6} stroke="#475569" strokeWidth="1" />
                <text
                  x={x}
                  y={padding.top + innerHeight + 20}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {xt.label}
                </text>
              </g>
            );
          })}

          {/* 7. Data Points (Interactive hover, tap, doctor pins) with >=44px Touch Targets */}
          {filteredLabs.map((lab) => {
            const cx = scaleX(new Date(lab.drawDate).getTime());
            const cy = scaleY(lab.normalizedValue);
            const isHovered = hoveredPoint?.id === lab.id;
            const isSelected = selectedPoint?.id === lab.id;
            const hasDoctorComment = Boolean(lab.doctorComment || (lab.doctorComments && lab.doctorComments.length > 0));

            // Status color hierarchy
            let pointColor = '#38bdf8'; // Sky
            let strokeColor = '#0284c7';
            if (lab.isCritical || lab.flag === 'CRITICAL_HIGH' || lab.flag === 'CRITICAL_LOW') {
              pointColor = '#f43f5e'; // Rose
              strokeColor = '#e11d48';
            } else if (lab.isBorderline) {
              pointColor = '#f59e0b'; // Amber
              strokeColor = '#d97706';
            } else if (lab.flag === 'HIGH' || lab.flag === 'LOW') {
              pointColor = '#fb923c'; // Orange
              strokeColor = '#ea580c';
            }

            return (
              <g
                key={lab.id}
                className="cursor-pointer transition-transform duration-150"
                onClick={() => handlePointClick(lab)}
                onMouseEnter={() => setHoveredPoint(lab)}
                onMouseLeave={() => setHoveredPoint(null)}
                role="button"
                tabIndex={0}
                aria-label={`${markerName}: ${lab.normalizedValue} ${lab.normalizedUnit} on ${new Date(lab.drawDate).toLocaleDateString()}`}
              >
                {/* Generous touch hit target (44px diameter = r=22) so mobile taps never fail */}
                <circle cx={cx} cy={cy} r="22" fill="transparent" />

                {/* Outer hover/select halo */}
                {(isHovered || isSelected) && (
                  <circle cx={cx} cy={cy} r="15" fill={pointColor} fillOpacity="0.28" className="animate-pulse" />
                )}

                {/* Main point circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered || isSelected ? '7' : '5.5'}
                  fill={pointColor}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                />

                {/* Doctor Pinned Comment Marker (📌) (LS8) */}
                {hasDoctorComment && (
                  <g transform={`translate(${cx - 8}, ${cy - 24})`}>
                    <circle cx="8" cy="8" r="8" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" className="shadow-md" />
                    <text x="8" y="11" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#451a03">
                      📌
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Card (Hover or Selected Point) - Desktop: absolute top-right; Mobile: Docked bottom to avoid obscuring data points */}
        {(hoveredPoint || selectedPoint) && (
          <div className="relative sm:absolute sm:top-3 sm:right-3 z-20 bg-canvas-card/95 backdrop-blur-md border-t sm:border border-canvas-border sm:rounded-xl p-3.5 shadow-md w-full sm:max-w-xs space-y-1.5 animate-fade-in text-body-sm">
            {(() => {
              const p = hoveredPoint || selectedPoint!;
              const hasComment = p.doctorComment || (p.doctorComments && p.doctorComments.length > 0);
              const commentObj = p.doctorComment || p.doctorComments?.[0];

              return (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-canvas-border pb-1.5">
                    <span className="font-bold text-slate-900">
                      {new Date(p.drawDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    <span
                      className={`text-caption px-2 py-0.5 rounded-full font-bold uppercase border ${
                        p.isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : p.isBorderline
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {p.flag || (p.isBorderline ? 'BORDERLINE' : 'NORMAL')}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted">Your value:</span>
                    <span className="text-body font-black text-slate-900">
                      {p.normalizedValue} {p.normalizedUnit}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-4 text-caption">
                    <span className="text-muted">Normal range:</span>
                    <span className="text-slate-700">
                      {(p.referenceRange?.low ?? 0)}–{(p.referenceRange?.high ?? 100)} {p.normalizedUnit}
                    </span>
                  </div>

                  {hasComment && (
                    <div className="mt-2 pt-2 border-t border-canvas-border text-caption space-y-1 bg-amber-50 p-2 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-1 text-amber-700 font-bold">
                        <Pin className="w-3.5 h-3.5" />
                        <span>Dr. Review Note ({commentObj?.doctorName || 'Clinician'})</span>
                      </div>
                      <p className="text-slate-900 leading-snug">{commentObj?.comment}</p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPoint(p);
                        setIsAddingComment(true);
                      }}
                      className="min-h-[44px] text-caption text-primary hover:text-primary-hover font-bold flex items-center justify-center gap-1.5 bg-primary-light hover:bg-primary-light/80 px-3 py-2 rounded-xl border border-primary-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Pin Doctor Note</span>
                    </button>

                    {selectedPoint && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPoint(null);
                          setHoveredPoint(null);
                          setIsAddingComment(false);
                        }}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-caption text-muted hover:text-slate-900 flex items-center justify-center font-semibold rounded-xl hover:bg-canvas-muted transition-colors"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Doctor Comment Pinning Modal / Inline Form */}
      {isAddingComment && selectedPoint && (
        <div className="bg-canvas-muted border border-primary-border rounded-xl p-4 space-y-3 animate-fade-in text-body-sm shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Pin className="w-4 h-4" />
              <span>Pin Clinician Review Note (📌 LS8)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingComment(false)}
              className="text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-muted leading-relaxed">
            Attaching authenticated clinical comment to <strong className="text-slate-900">{markerName} ({selectedPoint.normalizedValue} {selectedPoint.normalizedUnit})</strong> drawn on{' '}
            <strong className="text-slate-900">{new Date(selectedPoint.drawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>.
          </p>

          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="e.g. eGFR dropped to 28 mL/min; reducing Metformin to 500mg daily and holding NSAIDs..."
            rows={2}
            className="w-full bg-canvas-card border border-canvas-border rounded-xl p-2.5 text-slate-900 placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-body-sm resize-none"
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingComment(false)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-canvas-card hover:bg-white text-slate-700 font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDoctorComment}
              disabled={!newCommentText.trim()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center"
            >
              Pin Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
