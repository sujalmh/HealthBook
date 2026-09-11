import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LabRecord } from '@/types/vault';

interface StorySentenceProps {
  marker: string;
  labs: LabRecord[];
  className?: string;
  embedded?: boolean;
}

export const StorySentence: React.FC<StorySentenceProps> = ({ marker, labs, className = '', embedded = false }) => {
  if (!labs || labs.length === 0) {
    if (embedded) {
      return (
        <div className={`flex items-center gap-3 py-2 ${className}`}>
          <div className="p-1.5 rounded-lg bg-primary-light border border-primary-border text-primary shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-body-sm text-muted leading-relaxed">
            No results for <span className="font-semibold text-slate-900">{marker}</span>. Upload a lab paper or choose another test.
          </p>
        </div>
      );
    }
    return (
      <div className={`bg-canvas-card border border-canvas-border rounded-2xl p-4 flex items-center gap-3 shadow-sm ${className}`}>
        <div className="p-2 rounded-xl bg-primary-light border border-primary-border text-primary shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <p className="text-body-sm text-muted leading-relaxed">
          No results for <span className="font-semibold text-slate-900">{marker}</span>. Upload a lab paper or choose another test.
        </p>
      </div>
    );
  }

  const sorted = [...labs].sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const count = sorted.length;

  const firstDate = new Date(first.drawDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const lastDate = new Date(last.drawDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const delta = Math.round((last.normalizedValue - first.normalizedValue) * 100) / 100;


  const isCritical = last.isCritical || last.flag === 'CRITICAL_HIGH' || last.flag === 'CRITICAL_LOW';
  const isHigh = last.flag === 'HIGH' || (last.referenceRange && typeof last.referenceRange.high === 'number' && last.normalizedValue > last.referenceRange.high);
  const isLow = last.flag === 'LOW' || (last.referenceRange && typeof last.referenceRange.low === 'number' && last.normalizedValue < last.referenceRange.low);
  const isBorderline = Boolean(last.isBorderline);

  let storySentence = '';
  let trendIcon = <Minus className="w-4 h-4 text-muted" />;
  let badgeColor = 'bg-muted-subtle text-muted border-canvas-border';

  const unitStr = last.normalizedUnit ? ` ${last.normalizedUnit}` : '';
  const prevStr = count > 1 ? ` (previously ${first.normalizedValue}${unitStr})` : '';

  if (isCritical) {
    storySentence = `${marker} is critically ${isLow || last.flag === 'CRITICAL_LOW' ? 'low' : 'high'} at ${last.normalizedValue}${unitStr}${prevStr}.`;
    trendIcon = delta > 0 ? <TrendingUp className="w-4 h-4 text-rose-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />;
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isHigh) {
    const trendDetail = count > 1 && delta !== 0 ? (delta > 0 ? ` (up from ${first.normalizedValue})` : ` (down from ${first.normalizedValue})`) : '';
    storySentence = `${marker} is elevated at ${last.normalizedValue}${unitStr}${trendDetail}.`;
    trendIcon = delta > 0 ? <TrendingUp className="w-4 h-4 text-amber-600" /> : <Minus className="w-4 h-4 text-amber-600" />;
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (isLow) {
    const trendDetail = count > 1 && delta !== 0 ? (delta < 0 ? ` (down from ${first.normalizedValue})` : ` (up from ${first.normalizedValue})`) : '';
    storySentence = `${marker} is low at ${last.normalizedValue}${unitStr}${trendDetail}.`;
    trendIcon = delta < 0 ? <TrendingDown className="w-4 h-4 text-amber-600" /> : <Minus className="w-4 h-4 text-amber-600" />;
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (isBorderline) {
    storySentence = `${marker} is borderline at ${last.normalizedValue}${unitStr}${prevStr}.`;
    trendIcon = <AlertTriangle className="w-4 h-4 text-amber-600" />;
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    if (count > 1 && Math.abs(delta) > 0) {
      storySentence = `${marker} is stable within range at ${last.normalizedValue}${unitStr} (${delta > 0 ? 'up' : 'down'} from ${first.normalizedValue}).`;
      trendIcon = delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-emerald-600" />;
    } else {
      storySentence = `${marker} is in normal range at ${last.normalizedValue}${unitStr}.`;
      trendIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  const inner = (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-primary-light border border-primary-border text-primary shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-caption px-2 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${badgeColor}`}>
            {trendIcon}
            <span>{last.flag || (last.isBorderline ? 'BORDERLINE' : 'NORMAL')}</span>
          </span>
          <span className="text-caption text-muted">
            {count} results ({firstDate} → {lastDate})
          </span>
        </div>
        <p className="text-body font-medium text-slate-900 leading-relaxed truncate whitespace-nowrap overflow-hidden text-ellipsis max-w-full" title={storySentence}>
          {storySentence}
        </p>
      </div>
    </div>
  );

  if (embedded) {
    return <div className={`${className}`}>{inner}</div>;
  }

  return (
    <div className={`bg-canvas-card border border-canvas-border rounded-2xl p-4 shadow-sm ${className}`}>
      {inner}
    </div>
  );
};

