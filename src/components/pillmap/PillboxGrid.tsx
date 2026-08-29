/**
 * CareCanvas Component: PillboxGrid
 * 7x4 weekly drag-and-drop grid (Mon–Sun × Morning, Noon, Evening, Bedtime) with accessible typography,
 * chronotype-aware timing headers, drop target animations, and conflict arc anchoring.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sun, CloudSun, Sunset, Moon, Plus, AlertCircle, Utensils } from 'lucide-react';
import type {
  PillboxGrid as IPillboxGrid,
  PillSlotItem,
  DayOfWeek,
  TimeSlot,
  Chronotype,
  DietBadge,
  DuplicateIngredientAlert,
  GhostPreviewShift,
  InteractionArc,
  ArcCoordinate
} from '../../types/pillmap.ts';
import { DAYS_OF_WEEK, TIME_SLOTS, CHRONOTYPE_TIMES } from '../../types/pillmap.ts';
import { PillCard } from './PillCard.tsx';
import { SVGArcOverlay, calculateArcPath } from './SVGArcOverlay.tsx';

export interface PillboxGridProps {
  grid: IPillboxGrid;
  chronotype: Chronotype;
  dietBadges?: DietBadge[];
  duplicateAlerts?: DuplicateIngredientAlert[];
  interactionArcs?: InteractionArc[];
  ghostShifts?: GhostPreviewShift[];
  onDropPill: (dragData: any, targetDay: DayOfWeek, targetSlot: TimeSlot) => void;
  onRemovePill: (pillId: string) => void;
  onSimulateMissedDose?: (pill: PillSlotItem, day: DayOfWeek, slot: TimeSlot) => void;
  onQuickAdd?: (day: DayOfWeek, slot: TimeSlot) => void;
}

export const PillboxGrid: React.FC<PillboxGridProps> = ({
  grid,
  chronotype = 'standard',
  dietBadges = [],
  duplicateAlerts = [],
  interactionArcs = [],
  ghostShifts = [],
  onDropPill,
  onRemovePill,
  onSimulateMissedDose,
  onQuickAdd
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [arcCoordinates, setArcCoordinates] = useState<ArcCoordinate[]>([]);
  const [dimensions, setDimensions] = useState({ width: 1100, height: 650 });

  const times = CHRONOTYPE_TIMES[chronotype] || CHRONOTYPE_TIMES.standard;

  const slotMeta: Record<
    TimeSlot,
    { label: string; time: string; icon: React.ReactNode; mealIcon: string; mealLabel: string; headerBg: string }
  > = {
    morning: {
      label: 'Morning',
      time: times.morning,
      icon: <Sun className="w-4 h-4 text-amber-400" />,
      mealIcon: '🍳',
      mealLabel: 'Breakfast',
      headerBg: 'bg-amber-950/30 border-amber-900/50'
    },
    noon: {
      label: 'Noon',
      time: times.noon,
      icon: <CloudSun className="w-4 h-4 text-sky-400" />,
      mealIcon: '🥗',
      mealLabel: 'Lunch',
      headerBg: 'bg-sky-950/30 border-sky-900/50'
    },
    evening: {
      label: 'Evening',
      time: times.evening,
      icon: <Sunset className="w-4 h-4 text-orange-400" />,
      mealIcon: '🍲',
      mealLabel: 'Dinner',
      headerBg: 'bg-orange-950/30 border-orange-900/50'
    },
    bedtime: {
      label: 'Bedtime',
      time: times.bedtime,
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      mealIcon: '🌙',
      mealLabel: 'Snack / Rest',
      headerBg: 'bg-indigo-950/30 border-indigo-900/50'
    }
  };

  const dayLabels: Record<DayOfWeek, { short: string; full: string }> = {
    monday: { short: 'Mon', full: 'Monday' },
    tuesday: { short: 'Tue', full: 'Tuesday' },
    wednesday: { short: 'Wed', full: 'Wednesday' },
    thursday: { short: 'Thu', full: 'Thursday' },
    friday: { short: 'Fri', full: 'Friday' },
    saturday: { short: 'Sat', full: 'Saturday' },
    sunday: { short: 'Sun', full: 'Sunday' }
  };

  // Re-calculate coordinate positions for SVG Arcs
  const updateArcCoordinates = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    setDimensions({
      width: containerRect.width || 1100,
      height: containerRect.height || 650
    });

    if (interactionArcs.length === 0) {
      setArcCoordinates([]);
      return;
    }

    const calculated: ArcCoordinate[] = [];

    // Find DOM pill tiles matching drugA and drugB
    for (const arc of interactionArcs) {
      const drugAName = arc.drugA.toLowerCase();
      const drugBName = arc.drugB.toLowerCase();

      const elA = containerRef.current.querySelector(`[data-med-name*="${drugAName}" i]`) as HTMLElement | null;
      const elB = containerRef.current.querySelector(`[data-med-name*="${drugBName}" i]`) as HTMLElement | null;

      if (elA && elB && elA !== elB) {
        const rectA = elA.getBoundingClientRect();
        const rectB = elB.getBoundingClientRect();

        const startX = rectA.left - containerRect.left + rectA.width / 2;
        const startY = rectA.top - containerRect.top + rectA.height / 2;
        const endX = rectB.left - containerRect.left + rectB.width / 2;
        const endY = rectB.top - containerRect.top + rectB.height / 2;

        const path = calculateArcPath(startX, startY, endX, endY);

        calculated.push({
          id: arc.id,
          fromMed: arc.drugA,
          toMed: arc.drugB,
          startX,
          startY,
          endX,
          endY,
          path,
          arcColor: arc.arcColor,
          severity: arc.severity,
          mechanism: arc.mechanism,
          clinicalGuidance: arc.clinicalGuidance
        });
      } else {
        // Fallback slot estimation if specific DOM element is offscreen or Monday slot default
        const path = calculateArcPath(180, 150, 480, 420);
        calculated.push({
          id: arc.id,
          fromMed: arc.drugA,
          toMed: arc.drugB,
          startX: 180,
          startY: 150,
          endX: 480,
          endY: 420,
          path,
          arcColor: arc.arcColor,
          severity: arc.severity,
          mechanism: arc.mechanism,
          clinicalGuidance: arc.clinicalGuidance
        });
      }
    }

    setArcCoordinates(calculated);
  };

  useEffect(() => {
    updateArcCoordinates();
    const handleResize = () => updateArcCoordinates();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [grid, interactionArcs, ghostShifts]);

  // Check if a medication is involved in duplicate alert
  const isDuplicateIngredient = (medName: string) => {
    return duplicateAlerts.some(alert =>
      alert.drugsInvolved.some(d => d.name.toLowerCase().includes(medName.toLowerCase()))
    );
  };

  // Drag-and-drop event handlers
  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCell !== cellKey) {
      setDragOverCell(cellKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, day: DayOfWeek, slot: TimeSlot) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (rawData) {
        const dragData = JSON.parse(rawData);
        onDropPill(dragData, day, slot);
      }
    } catch (err) {
      console.error('Pillbox drop error:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 select-none"
    >
      {/* SVG Conflict Arc Overlay */}
      <SVGArcOverlay
        arcs={interactionArcs}
        gridCoordinates={arcCoordinates}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* Main Responsive Grid Container */}
      <div className="overflow-x-auto min-w-[960px]">
        {/* Table Structure */}
        <table className="w-full border-collapse">
          {/* Day Column Headers */}
          <thead>
            <tr>
              {/* Time Slot column title */}
              <th className="p-3 w-40 text-left bg-slate-900 border-b border-r border-slate-800 text-xs font-black tracking-wider text-slate-400 uppercase rounded-tl-xl">
                Time Slot
              </th>
              {DAYS_OF_WEEK.map((day) => (
                <th
                  key={day}
                  className="p-3 text-center bg-slate-900 border-b border-r border-slate-800 last:border-r-0 text-xs font-bold text-slate-200"
                >
                  <div className="flex flex-col items-center">
                    <span className="font-extrabold text-sm tracking-tight text-white">
                      {dayLabels[day].short}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium capitalize">
                      {dayLabels[day].full}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* 4 Time Rows (Morning, Noon, Evening, Bedtime) */}
          <tbody>
            {TIME_SLOTS.map((slot) => {
              const meta = slotMeta[slot];

              return (
                <tr key={slot} className="border-b border-slate-800/80 last:border-b-0">
                  {/* Row Header: Slot Label, Chronotype Time, Meal Icon */}
                  <td className={`p-3 align-top border-r border-slate-800 ${meta.headerBg}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-black text-xs text-white">
                        {meta.icon}
                        <span>{meta.label}</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-sky-400 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-slate-800 inline-block">
                        {meta.time}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1 font-medium">
                        <span>{meta.mealIcon}</span>
                        <span>{meta.mealLabel}</span>
                      </div>
                    </div>
                  </td>

                  {/* 7 Day Cells */}
                  {DAYS_OF_WEEK.map((day) => {
                    const cellKey = `${day}_${slot}`;
                    const pillsInSlot = (grid[day] && grid[day][slot]) || [];
                    const isDragOver = dragOverCell === cellKey;

                    // Check for ghost preview shifts into this cell
                    const ghostsInThisSlot = ghostShifts.filter((g) => {
                      if (g.toSlot !== slot) return false;
                      if (g.toDay && g.toDay !== day) return false;
                      return true;
                    });

                    return (
                      <td
                        key={cellKey}
                        onDragOver={(e) => handleDragOver(e, cellKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day, slot)}
                        className={`p-2 align-top border-r border-slate-800/80 last:border-r-0 transition-colors min-w-[130px] ${
                          isDragOver
                            ? 'bg-sky-950/50 ring-2 ring-inset ring-sky-500/80'
                            : 'bg-slate-900/30 hover:bg-slate-900/50'
                        }`}
                      >
                        <div className="min-h-[110px] flex flex-col gap-2">
                          {/* Active Pills */}
                          {pillsInSlot.map((pill) => (
                            <PillCard
                              key={pill.id}
                              pill={pill}
                              day={day}
                              slot={slot}
                              dietBadges={dietBadges}
                              isDuplicate={isDuplicateIngredient(pill.name)}
                              onRemove={onRemovePill}
                              onSimulate={(p, d, s) =>
                                onSimulateMissedDose?.(p, (d || day) as DayOfWeek, (s || slot) as TimeSlot)
                              }
                            />
                          ))}

                          {/* Ghost Preview Shifts */}
                          {ghostsInThisSlot.map((ghost, gIdx) => (
                            <PillCard
                              key={`ghost_${ghost.medId}_${gIdx}`}
                              pill={{
                                id: `ghost_${ghost.medId}`,
                                medId: ghost.medId,
                                name: ghost.medName,
                                dosage: 'Proposed',
                                color: '#10B981',
                                shape: 'capsule',
                                withFood: false,
                                status: 'ghost_preview'
                              }}
                              day={day}
                              slot={slot}
                              isGhostPreview={true}
                            />
                          ))}

                          {/* Empty Slot Drop Area / Quick Add */}
                          {pillsInSlot.length === 0 && ghostsInThisSlot.length === 0 && (
                            <button
                              type="button"
                              onClick={() => onQuickAdd?.(day, slot)}
                              className="flex-1 flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-800 hover:border-slate-600 text-slate-600 hover:text-slate-300 transition-all group/btn"
                              title={`Add medication to ${dayLabels[day].full} ${meta.label}`}
                            >
                              <Plus className="w-4 h-4 group-hover/btn:scale-125 transition-transform text-slate-500" />
                              <span className="text-[10px] font-medium mt-1 opacity-60">Empty Slot</span>
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
