import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LabRecord } from '@/types/vault';

interface StorySentenceProps {
  marker: string;
  labs: LabRecord[];
  className?: string;
}

export const StorySentence: React.FC<StorySentenceProps> = ({ marker, labs, className = '' }) => {
  if (!labs || labs.length === 0) {
    return (
      <div className={`bg-white/90 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 ${className}`}>
        <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />
        <p className="text-xs text-slate-600">
          No longitudinal data points available for <span className="font-semibold text-slate-800">{marker}</span>. Upload a lab report or select another marker.
        </p>
      </div>
    );
  }

  // Sort ascending by drawDate
  const sorted = [...labs].sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const count = sorted.length;

  const firstDate = new Date(first.drawDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const lastDate = new Date(last.drawDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const delta = Math.round((last.normalizedValue - first.normalizedValue) * 100) / 100;
  const pctChange = first.normalizedValue !== 0 ? Math.round(((last.normalizedValue - first.normalizedValue) / first.normalizedValue) * 100) : 0;

  // Trajectory direction & clinical evaluation
  const isDecliningBad = (marker.toLowerCase().includes('egfr') && delta < -5) ||
    (marker.toLowerCase().includes('creat') && delta > 0.3) ||
    ((marker.toLowerCase().includes('glucose') || marker.toLowerCase().includes('a1c')) && delta > 15) ||
    (marker.toLowerCase().includes('potassium') && (last.normalizedValue > 5.0 || last.normalizedValue < 3.5));

  const isImproving = (marker.toLowerCase().includes('egfr') && delta > 5) ||
    (marker.toLowerCase().includes('creat') && delta < -0.2) ||
    ((marker.toLowerCase().includes('glucose') || marker.toLowerCase().includes('a1c')) && delta < -10) ||
    ((marker.toLowerCase().includes('ldl') || marker.toLowerCase().includes('cholesterol')) && delta < -20);

  // Generate automated clinical story sentence
  let storySentence = '';
  let trendIcon = <Minus className="w-4 h-4 text-slate-600" />;
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';

  if (marker.toLowerCase().includes('egfr')) {
    if (last.normalizedValue < 30) {
      storySentence = `eGFR dropped from ${first.normalizedValue} to ${last.normalizedValue} ${last.normalizedUnit} between ${firstDate} and ${lastDate} (${pctChange}% change) — indicating Stage 4 kidney filtration and requiring medication dosage adjustment (e.g. Metformin halving).`;
      trendIcon = <TrendingDown className="w-4 h-4 text-rose-400" />;
      badgeColor = 'bg-rose-500/20 text-rose-700 border-rose-500/30';
    } else if (delta < 0) {
      storySentence = `eGFR declined steadily from ${first.normalizedValue} to ${last.normalizedValue} ${last.normalizedUnit} across ${count} lab draws (${firstDate}–${lastDate}), remaining closely monitored post-discharge.`;
      trendIcon = <TrendingDown className="w-4 h-4 text-amber-400" />;
      badgeColor = 'bg-amber-500/20 text-amber-700 border-amber-200';
    } else {
      storySentence = `eGFR maintained stable renal clearance at ${last.normalizedValue} ${last.normalizedUnit} across ${firstDate}–${lastDate}.`;
      trendIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      badgeColor = 'bg-emerald-500/20 text-emerald-700 border-emerald-200';
    }
  } else if (marker.toLowerCase().includes('creat')) {
    if (last.normalizedValue > 1.5) {
      storySentence = `Creatinine rose from ${first.normalizedValue} to ${last.normalizedValue} ${last.normalizedUnit} (${delta > 0 ? '+' : ''}${delta}) between ${firstDate} and ${lastDate} — reflecting decreased glomerular filtration rate and potential drug interactions.`;
      trendIcon = <TrendingUp className="w-4 h-4 text-rose-400" />;
      badgeColor = 'bg-rose-500/20 text-rose-700 border-rose-500/30';
    } else {
      storySentence = `Creatinine levels stable around ${last.normalizedValue} ${last.normalizedUnit} (reference: ${last.referenceRange.low}–${last.referenceRange.high} ${last.normalizedUnit}).`;
      trendIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      badgeColor = 'bg-emerald-500/20 text-emerald-700 border-emerald-200';
    }
  } else if (marker.toLowerCase().includes('glucose') || marker.toLowerCase().includes('a1c')) {
    if (delta > 10) {
      storySentence = `${marker} shifted from ${first.normalizedValue} to ${last.normalizedValue} ${last.normalizedUnit} (+${pctChange}%) between ${firstDate} and ${lastDate}, with spikes observed during steroid burst therapy.`;
      trendIcon = <TrendingUp className="w-4 h-4 text-amber-400" />;
      badgeColor = 'bg-amber-500/20 text-amber-700 border-amber-200';
    } else {
      storySentence = `${marker} remained under glycemic control at ${last.normalizedValue} ${last.normalizedUnit} following regular medication adherence.`;
      trendIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      badgeColor = 'bg-emerald-500/20 text-emerald-700 border-emerald-200';
    }
  } else if (marker.toLowerCase().includes('potassium')) {
    if (last.normalizedValue > 5.0) {
      storySentence = `Serum Potassium elevated to ${last.normalizedValue} ${last.normalizedUnit} in ${lastDate} — borderline high; monitoring indicated with current ACE-inhibitor / diuretic regimen.`;
      trendIcon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
      badgeColor = 'bg-amber-500/20 text-amber-700 border-amber-200';
    } else {
      storySentence = `Potassium maintained in safe physiological range at ${last.normalizedValue} ${last.normalizedUnit} (3.5–5.0 ${last.normalizedUnit}).`;
      trendIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      badgeColor = 'bg-emerald-500/20 text-emerald-700 border-emerald-200';
    }
  } else if (marker.toLowerCase().includes('ldl') || marker.toLowerCase().includes('cholesterol')) {
    if (delta < 0) {
      storySentence = `${marker} decreased from ${first.normalizedValue} to ${last.normalizedValue} ${last.normalizedUnit} (-${Math.abs(pctChange)}%) — demonstrating effective lipid lowering on Atorvastatin therapy.`;
      trendIcon = <TrendingDown className="w-4 h-4 text-emerald-400" />;
      badgeColor = 'bg-emerald-500/20 text-emerald-700 border-emerald-200';
    } else {
      storySentence = `${marker} evaluated at ${last.normalizedValue} ${last.normalizedUnit} over ${count} longitudinal records.`;
      trendIcon = <Minus className="w-4 h-4 text-slate-600" />;
      badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
    }
  } else {
    storySentence = `${marker} recorded at ${last.normalizedValue} ${last.normalizedUnit} on ${lastDate} (trajectory delta: ${delta > 0 ? '+' : ''}${delta} ${last.normalizedUnit} since ${firstDate}).`;
    trendIcon = <Minus className="w-4 h-4 text-slate-600" />;
    badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  }

  return (
    <div className={`bg-gradient-to-r from-white via-slate-50/95 to-white border border-slate-200 rounded-2xl p-4 shadow-md ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mt-0.5 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Story Sentence (LS6)</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${badgeColor}`}>
                {trendIcon}
                <span>{last.flag || (last.isBorderline ? 'BORDERLINE' : 'NORMAL')}</span>
              </span>
              <span className="text-[11px] text-slate-600">
                {count} data points ({firstDate} → {lastDate})
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
              {storySentence}
            </p>
          </div>
        </div>

        {/* Quick Delta Stats */}
        <div className="flex items-center gap-2 sm:self-center shrink-0 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">Trajectory Delta</div>
            <div className={`text-xs sm:text-sm font-black ${delta > 0 ? (isDecliningBad ? 'text-rose-400' : 'text-emerald-400') : (isImproving ? 'text-emerald-400' : 'text-slate-800')}`}>
              {delta > 0 ? `+${delta}` : delta} {last.normalizedUnit}
              <span className="text-[10px] ml-1 font-semibold opacity-75">
                ({pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
