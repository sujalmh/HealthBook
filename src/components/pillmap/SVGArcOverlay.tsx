/**
 * Healthbook Component: SVGArcOverlay
 * Real-time dynamic SVG bezier curves between conflicting medications on the 7x4 PillMap grid.
 * Severity color hierarchy: Red (#EF4444: Contraindicated), Orange (#F97316: Major), Yellow (#EAB308: Moderate).
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, X, ShieldAlert, Sparkles } from 'lucide-react';
import type { InteractionArc, ArcCoordinate, DayOfWeek, TimeSlot } from '../../types/pillmap.ts';
import { ModalPortal } from '../common/ModalPortal';

/**
 * Pure helper to compute an SVG cubic bezier path string between two 2D points.
 */
export function calculateArcPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curvature: number = 0.3
): string {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  // Calculate perpendicular normal vector
  const nx = -dy / dist;
  const ny = dx / dist;

  // Arch height proportional to distance, with minimum height
  const arcHeight = Math.max(30, Math.min(120, dist * curvature));

  // Control points arching upwards / outwards
  const cp1x = startX + dx * 0.25 + nx * arcHeight;
  const cp1y = startY + dy * 0.25 + ny * arcHeight - (Math.abs(dx) > Math.abs(dy) ? arcHeight * 0.5 : 0);

  const cp2x = startX + dx * 0.75 + nx * arcHeight;
  const cp2y = startY + dy * 0.75 + ny * arcHeight - (Math.abs(dx) > Math.abs(dy) ? arcHeight * 0.5 : 0);

  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

/**
 * Calculates slot coordinates based on grid column (day) and row (slot) indexes.
 */
export function calculateSlotArcCoordinates(
  dayIndexA: number,
  slotIndexA: number,
  dayIndexB: number,
  slotIndexB: number,
  cellWidth: number = 140,
  cellHeight: number = 120,
  offsetX: number = 80,
  offsetY: number = 60
): { startX: number; startY: number; endX: number; endY: number; path: string } {
  const startX = offsetX + dayIndexA * cellWidth + cellWidth / 2;
  const startY = offsetY + slotIndexA * cellHeight + cellHeight / 2;
  const endX = offsetX + dayIndexB * cellWidth + cellWidth / 2;
  const endY = offsetY + slotIndexB * cellHeight + cellHeight / 2;
  const path = calculateArcPath(startX, startY, endX, endY);

  return { startX, startY, endX, endY, path };
}

export interface SVGArcOverlayProps {
  arcs: InteractionArc[];
  gridCoordinates?: ArcCoordinate[];
  width?: number;
  height?: number;
  onSelectArc?: (arc: InteractionArc) => void;
}

export const SVGArcOverlay: React.FC<SVGArcOverlayProps> = ({
  arcs,
  gridCoordinates = [],
  width = 1100,
  height = 650,
  onSelectArc
}) => {
  const [selectedArc, setSelectedArc] = useState<InteractionArc | null>(null);
  const [hoveredArcId, setHoveredArcId] = useState<string | null>(null);

  const handleArcClick = (arc: InteractionArc) => {
    setSelectedArc(arc);
    if (onSelectArc) {
      onSelectArc(arc);
    }
  };

  return (
    <>
      <svg
        className="absolute inset-0 pointer-events-none z-20 w-full h-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Animated gradient for Contraindicated Arcs */}
          <linearGradient id="contraindicated-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#F87171" stopOpacity="1" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.9" />
          </linearGradient>

          {/* Glowing filter */}
          <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="arc-glow-strong" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Marker arrows */}
          <marker
            id="arrow-red"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
          </marker>
          <marker
            id="arrow-orange"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#F97316" />
          </marker>
          <marker
            id="arrow-yellow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#EAB308" />
          </marker>
        </defs>

        {/* Render Each Conflict Arc */}
        {gridCoordinates.map((coord, idx) => {
          const isHovered = hoveredArcId === coord.id;
          const isContraindicated = coord.severity === 'CONTRAINDICATED';
          const isMajor = coord.severity === 'MAJOR';

          // Match corresponding full arc definition
          const fullArc = arcs.find(a => a.id === coord.id) || {
            id: coord.id,
            drugA: coord.fromMed,
            drugB: coord.toMed,
            severity: coord.severity,
            arcColor: coord.arcColor,
            mechanism: coord.mechanism,
            clinicalGuidance: coord.clinicalGuidance,
            affectedSlots: []
          };

          const strokeColor = coord.arcColor || (isContraindicated ? '#EF4444' : isMajor ? '#F97316' : '#EAB308');

          return (
            <g
              key={`arc-${coord.id}-${idx}`}
              className="pointer-events-auto cursor-pointer transition-all duration-300"
              onClick={() => handleArcClick(fullArc)}
              onMouseEnter={() => setHoveredArcId(coord.id)}
              onMouseLeave={() => setHoveredArcId(null)}
            >
              {/* Invisible wide hit target for easy clicking */}
              <path
                d={coord.path}
                fill="none"
                stroke="transparent"
                strokeWidth={24}
                className="cursor-pointer"
              />

              {/* Background glow path */}
              <path
                d={coord.path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isHovered ? 8 : isContraindicated ? 5 : 3}
                strokeOpacity={isHovered ? 0.6 : 0.3}
                filter={isContraindicated ? 'url(#arc-glow-strong)' : 'url(#arc-glow)'}
                className={isContraindicated ? 'animate-pulse' : ''}
              />

              {/* Main Crisp Arc Path */}
              <path
                d={coord.path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isHovered ? 3.5 : 2.5}
                strokeDasharray={isContraindicated ? 'none' : isMajor ? '8 4' : '4 3'}
                markerEnd={isContraindicated ? 'url(#arrow-red)' : isMajor ? 'url(#arrow-orange)' : 'url(#arrow-yellow)'}
                className="transition-all duration-200"
              />

              {/* Interactive Center Badge Icon */}
              {coord.startX && coord.endX && (
                <g
                  transform={`translate(${(coord.startX + coord.endX) / 2 - 12}, ${(coord.startY + coord.endY) / 2 - 20})`}
                  className="filter drop-shadow-md"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r={isHovered ? 13 : 11}
                    fill="white"
                    stroke={strokeColor}
                    strokeWidth="2"
                    className="transition-all"
                  />
                  <text
                    x="12"
                    y="16"
                    textAnchor="middle"
                    fill={strokeColor}
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {isContraindicated ? 'X' : isMajor ? '!' : '•'}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Slide-over / Modal Clinical Mechanism Sheet */}
      <ModalPortal isOpen={!!selectedArc} onClose={() => setSelectedArc(null)} ariaLabel="Drug Interaction Details">
        {selectedArc && (
          <div className="bg-white border border-canvas-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto">
            {/* Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                selectedArc.severity === 'CONTRAINDICATED'
                  ? 'bg-rose-100 border-rose-200 text-rose-700'
                  : selectedArc.severity === 'MAJOR'
                  ? 'bg-amber-100 border-amber-200 text-amber-700'
                  : 'bg-yellow-50 border-yellow-800/80 text-yellow-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {selectedArc.severity === 'CONTRAINDICATED' ? (
                  <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-body sm:text-base tracking-tight">
                    {selectedArc.severity === 'CONTRAINDICATED'
                      ? 'Contraindicated Drug Interaction'
                      : selectedArc.severity === 'MAJOR'
                      ? 'Major Drug Interaction'
                      : 'Moderate Drug Interaction'}
                  </h3>
                  <p className="text-xs opacity-80">
                    {selectedArc.drugA} + {selectedArc.drugB}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedArc(null)}
                className="p-2 rounded-xl hover:bg-black/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                aria-label="Close interaction details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4 text-body text-slate-800">
              <div className="bg-canvas-muted p-3.5 sm:p-4 rounded-xl border border-canvas-border">
                <span className="text-caption uppercase tracking-wider text-muted font-bold block mb-1">
                  Clinical Mechanism
                </span>
                <p className="text-body-sm sm:text-body text-slate-900 leading-relaxed font-medium">
                  {selectedArc.mechanism}
                </p>
              </div>

              <div className="bg-sky-50 p-3.5 sm:p-4 rounded-xl border border-sky-200 space-y-1.5">
                <span className="text-caption tracking-wide uppercase text-sky-700 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Recommended Clinical Action
                </span>
                <p className="text-sky-900 leading-relaxed text-body-sm sm:text-body">
                  {selectedArc.clinicalGuidance}
                </p>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-2 pt-2 border-t border-slate-200">
                <Info className="w-4 h-4 text-slate-600 shrink-0" />
                <span>
                  Consult your prescribing physician or pharmacist before discontinuing or changing medication timing.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 bg-canvas-muted border-t border-canvas-border flex justify-end">
              <button
                onClick={() => setSelectedArc(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-body-sm font-bold transition-colors shadow-sm min-h-[44px] flex items-center justify-center"
              >
                Close Explanation
              </button>
            </div>
          </div>
        )}
      </ModalPortal>
    </>
  );
};
