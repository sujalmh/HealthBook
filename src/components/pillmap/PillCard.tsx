/**
 * CareCanvas Component: PillCard
 * Accessible, high-contrast draggable pill card displaying dosage, shape icon, meal badges, and conflict indicators.
 */

import React from 'react';
import { Trash2, HelpCircle, GripVertical, AlertTriangle, ArrowRight } from 'lucide-react';
import type { PillSlotItem, DietBadge } from '../../types/pillmap.ts';
import { MealBadges } from './MealBadges.tsx';

export interface PillCardProps {
  pill: PillSlotItem;
  day?: string;
  slot?: string;
  dietBadges?: DietBadge[];
  isDuplicate?: boolean;
  onRemove?: (pillId: string) => void;
  onSimulate?: (pill: PillSlotItem, day?: string, slot?: string) => void;
  isGhostPreview?: boolean;
  isDragging?: boolean;
}

export const PillCard: React.FC<PillCardProps> = ({
  pill,
  day = 'monday',
  slot = 'morning',
  dietBadges = [],
  isDuplicate = false,
  onRemove,
  onSimulate,
  isGhostPreview = false,
  isDragging = false
}) => {
  // Shape rendering
  const renderShapeIcon = () => {
    switch (pill.shape) {
      case 'capsule':
        return (
          <div
            className="w-5 h-2.5 rounded-full border border-white/40 shadow-sm flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: pill.color || '#3B82F6' }}
            title="Capsule"
          >
            <div className="w-1/2 h-full bg-white/30 border-r border-black/20" />
          </div>
        );
      case 'oval':
        return (
          <div
            className="w-4 h-3 rounded-full border border-white/40 shadow-sm"
            style={{ backgroundColor: pill.color || '#10B981' }}
            title="Oval tablet"
          />
        );
      case 'round':
      default:
        return (
          <div
            className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
            style={{ backgroundColor: pill.color || '#F59E0B' }}
            title="Round tablet"
          />
        );
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        pillId: pill.id,
        medId: pill.medId,
        name: pill.name,
        dosage: pill.dosage,
        fromDay: day,
        fromSlot: slot
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const isGhost = isGhostPreview || pill.status === 'ghost_preview';

  return (
    <div
      draggable={!isGhost}
      onDragStart={handleDragStart}
      data-med-id={pill.medId || pill.id}
      data-med-name={pill.name}
      className={`group relative rounded-xl p-3 transition-all select-none border ${
        isGhost
          ? 'bg-emerald-50 border-dashed border-emerald-300 text-emerald-800 animate-pulse shadow-sm'
          : isDuplicate
          ? 'bg-white border-amber-300 shadow-sm shadow-amber-500/10 text-amber-900'
          : 'bg-white border-canvas-border hover:border-primary-border shadow-sm hover:shadow-md text-slate-900'
      } ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}`}
      role="article"
      aria-label={`${pill.name} ${pill.dosage}`}
    >
      {/* Ghost Preview Header Badge */}
      {isGhost && (
        <div className="flex items-center gap-1 mb-1.5 px-1.5 py-0.5 rounded-lg bg-emerald-500 text-white font-bold text-[9px] uppercase tracking-wider">
          <ArrowRight className="w-2.5 h-2.5" /> Proposed Timing Shift
        </div>
      )}

      {/* Duplicate Ingredient Warning Tag */}
      {isDuplicate && !isGhost && (
        <div className="flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 border border-amber-200 font-bold text-[9px]">
          <AlertTriangle className="w-2.5 h-2.5" /> Duplicate Ingredient
        </div>
      )}

      {/* Top Row: Shape Icon, Brand/Generic Name, Drag Handle, Actions */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">{renderShapeIcon()}</span>
          <div className="min-w-0">
            <h4 className="font-semibold text-body leading-tight truncate text-slate-900 tracking-tight">
              {pill.name} <span className="font-normal text-body-sm text-muted">{pill.dosage}</span>
            </h4>
          </div>
        </div>

        {/* Action icons - 44px touch target ensured via min-height on parent, compact buttons with focus rings */}
        {!isGhost && (
          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
            {onSimulate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSimulate(pill, day, slot);
                }}
                className="p-1.5 rounded-lg text-muted hover:text-amber-700 hover:bg-amber-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                title="Simulate missed dose clinical risk"
                aria-label={`Simulate missing ${pill.name}`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(pill.id);
                }}
                className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                title="Remove from pillbox"
                aria-label={`Remove ${pill.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="cursor-grab active:cursor-grabbing text-muted hover:text-slate-700 p-1">
              <GripVertical className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>

      {/* Dosage already shown with name — no redundant middle row */}

      {/* Bottom Row: Meal & Food Badges */}
      <MealBadges
        withFood={pill.withFood}
        emptyStomach={pill.emptyStomach}
        avoidGrapefruit={pill.avoidGrapefruit}
        avoidAlcohol={pill.avoidAlcohol}
        avoidDairy={pill.avoidDairy}
        dietBadges={dietBadges.filter(d => d.drugName.toLowerCase().includes(pill.name.toLowerCase()) || (pill.genericName && d.drugName.toLowerCase().includes(pill.genericName.toLowerCase())))}
      />
    </div>
  );
};
