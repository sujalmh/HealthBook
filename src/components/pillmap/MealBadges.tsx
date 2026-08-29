/**
 * CareCanvas Component: MealBadges
 * Interactive meal-time badges and food interaction flags attached to medications.
 * Badges: 🍽️ Take with Food, 🥣 Empty Stomach, 🚫 No Grapefruit, 🥬 Vit K, 🥛 Separate Calcium, 🚫 Zero Alcohol, 🧂 K+ Salt.
 */

import React, { useState } from 'react';
import { Utensils, X, AlertCircle, Info, Sparkles } from 'lucide-react';
import type { DietBadge } from '../../types/pillmap.ts';

export interface MealBadgesProps {
  withFood?: boolean;
  emptyStomach?: boolean;
  avoidGrapefruit?: boolean;
  avoidAlcohol?: boolean;
  avoidDairy?: boolean;
  dietBadges?: DietBadge[];
  onBadgeClick?: (badge: { title: string; mechanism: string; guidance: string; icon: string }) => void;
}

export const MealBadges: React.FC<MealBadgesProps> = ({
  withFood,
  emptyStomach,
  avoidGrapefruit,
  avoidAlcohol,
  avoidDairy,
  dietBadges = [],
  onBadgeClick
}) => {
  const [selectedBadge, setSelectedBadge] = useState<{
    title: string;
    mechanism: string;
    guidance: string;
    icon: string;
    severity?: string;
  } | null>(null);

  const handleClick = (badge: {
    title: string;
    mechanism: string;
    guidance: string;
    icon: string;
    severity?: string;
  }) => {
    setSelectedBadge(badge);
    if (onBadgeClick) {
      onBadgeClick(badge);
    }
  };

  // Compile individual badges from flags and dynamic dietBadges
  const badgesToRender: {
    key: string;
    label: string;
    icon: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    mechanism: string;
    guidance: string;
    severity: string;
  }[] = [];

  if (withFood) {
    badgesToRender.push({
      key: 'with_food',
      label: 'With Meal',
      icon: '🍽️',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-700/60',
      mechanism: 'Taking this medication with meals protects stomach lining and optimizes oral absorption.',
      guidance: 'Take during or immediately following breakfast, lunch, or dinner with a full glass of water.',
      severity: 'INFO'
    });
  }

  if (emptyStomach) {
    badgesToRender.push({
      key: 'empty_stomach',
      label: 'Empty Stomach',
      icon: '🥣',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-700/60',
      mechanism: 'Food, coffee, or calcium binds the active molecule and significantly impedes gastrointestinal absorption.',
      guidance: 'Take first thing in the morning with plain water, 30 to 60 minutes before breakfast or coffee.',
      severity: 'MAJOR'
    });
  }

  if (avoidGrapefruit) {
    badgesToRender.push({
      key: 'no_grapefruit',
      label: 'No Grapefruit',
      icon: '🍊',
      bgColor: 'bg-rose-100',
      textColor: 'text-rose-700',
      borderColor: 'border-rose-200',
      mechanism: 'Grapefruit furanocoumarins inhibit CYP3A4 metabolism in the gut, dangerously spiking blood levels.',
      guidance: 'Completely avoid grapefruit, Seville oranges, and pomelos while taking this medication.',
      severity: 'MAJOR'
    });
  }

  if (avoidAlcohol) {
    badgesToRender.push({
      key: 'no_alcohol',
      label: 'Avoid Alcohol',
      icon: '🚫',
      bgColor: 'bg-rose-100',
      textColor: 'text-rose-700',
      borderColor: 'border-rose-200',
      mechanism: 'Alcohol enhances CNS depression and may trigger acute disulfiram-like acetaldehyde toxicity.',
      guidance: 'Do not consume alcoholic beverages during active course of treatment.',
      severity: 'CONTRAINDICATED'
    });
  }

  if (avoidDairy) {
    badgesToRender.push({
      key: 'no_dairy',
      label: 'Separate Dairy 2h',
      icon: '🥛',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-700/60',
      mechanism: 'Calcium ions chelate with the medication forming insoluble complexes that fail to absorb.',
      guidance: 'Take this medication at least 2 hours before or 4 hours after consuming milk, yogurt, cheese, or antacids.',
      severity: 'MAJOR'
    });
  }

  // Add specific diet badges from interaction engine
  for (const db of dietBadges) {
    if (!badgesToRender.some(b => b.label === db.badgeText || b.key.includes(db.id))) {
      badgesToRender.push({
        key: db.id,
        label: db.badgeText,
        icon: db.badgeText.includes('Vit K') ? '🥬' : db.badgeText.includes('Grapefruit') ? '🍊' : '🍽️',
        bgColor: db.severity === 'CONTRAINDICATED' ? 'bg-rose-100' : 'bg-amber-100',
        textColor: db.severity === 'CONTRAINDICATED' ? 'text-rose-700' : 'text-amber-700',
        borderColor: db.severity === 'CONTRAINDICATED' ? 'border-rose-200' : 'border-amber-700/60',
        mechanism: db.mechanism,
        guidance: db.clinicalGuidance,
        severity: db.severity
      });
    }
  }

  if (badgesToRender.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1 mt-1">
        {badgesToRender.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick({
                title: b.label,
                mechanism: b.mechanism,
                guidance: b.guidance,
                icon: b.icon,
                severity: b.severity
              });
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all hover:scale-105 ${b.bgColor} ${b.textColor} ${b.borderColor}`}
            title={`Click for dietary instruction: ${b.label}`}
          >
            <span>{b.icon}</span>
            <span className="truncate max-w-[100px]">{b.label}</span>
          </button>
        ))}
      </div>

      {/* Modal on click */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedBadge.icon}</span>
                <h3 className="font-bold text-sm text-slate-900">{selectedBadge.title}</h3>
              </div>
              <button
                onClick={() => setSelectedBadge(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                aria-label="Close dietary instruction"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-800">
              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-600">
                  Why is this required?
                </span>
                <p className="text-slate-800 leading-relaxed">{selectedBadge.mechanism}</p>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-800/50 space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> What you should do
                </span>
                <p className="text-emerald-100 leading-relaxed">{selectedBadge.guidance}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedBadge(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-100 text-white rounded-lg text-xs font-semibold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
