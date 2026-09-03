/**
 * Healthbook Component: ChangeBadge
 * Visual status badge for the 5 reconciliation states:
 * - CONTINUED (Green)
 * - DOSE_CHANGED (Blue)
 * - STOPPED (Red)
 * - NEW (Purple)
 * - HELD_AND_RESUMED (Amber)
 */

import React from 'react';
import {
  CheckCircle2,
  ArrowUpDown,
  XOctagon,
  Sparkles,
  RotateCcw,
  HelpCircle
} from 'lucide-react';
import type { ChangeStatusBadge } from '../../types/rxbridge.ts';

interface ChangeBadgeProps {
  status: ChangeStatusBadge;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  customLabel?: string;
  className?: string;
  tooltip?: string;
}

export const ChangeBadge: React.FC<ChangeBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  customLabel,
  className = '',
  tooltip
}) => {
  const getConfig = () => {
    switch (status) {
      case 'NEW':
        return {
          label: customLabel || 'NEW',
          icon: Sparkles,
          bgClass: 'bg-purple-50 text-clinical-purple border-purple-200 hover:bg-purple-100',
          dotClass: 'bg-clinical-purple',
          defaultTooltip: 'Brand new medication started in hospital or on discharge.'
        };
      case 'DOSE_CHANGED':
        return {
          label: customLabel || 'DOSE CHANGED',
          icon: ArrowUpDown,
          bgClass: 'bg-sky-50 text-clinical-blue border-sky-200 hover:bg-sky-100',
          dotClass: 'bg-clinical-blue',
          defaultTooltip: 'Dose, frequency, or administration route was modified.'
        };
      case 'STOPPED':
        return {
          label: customLabel || 'STOPPED',
          icon: XOctagon,
          bgClass: 'bg-rose-50 text-clinical-red border-rose-200 hover:bg-rose-100',
          dotClass: 'bg-clinical-red',
          defaultTooltip: 'Medication discontinued in hospital. Do NOT take old supply.'
        };
      case 'HELD_AND_RESUMED':
        return {
          label: customLabel || 'HELD & RESUMED',
          icon: RotateCcw,
          bgClass: 'bg-amber-50 text-clinical-amber border-amber-200 hover:bg-amber-100',
          dotClass: 'bg-clinical-amber shadow-amber-400/50',
          defaultTooltip: 'Temporarily paused during inpatient stay, now resumed at home dose.'
        };
      case 'CONTINUED':
      default:
        return {
          label: customLabel || 'CONTINUED',
          icon: CheckCircle2,
          bgClass: 'bg-emerald-50 text-clinical-emerald border-emerald-200 hover:bg-emerald-100',
          dotClass: 'bg-clinical-emerald',
          defaultTooltip: 'Unchanged from regular home baseline regimen.'
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1 rounded-md',
    md: 'text-xs px-2.5 py-1 gap-1.5 rounded-lg',
    lg: 'text-sm px-3.5 py-1.5 gap-2 rounded-xl'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide uppercase border transition-colors shadow-sm select-none ${
        config.bgClass
      } ${sizeClasses[size]} ${className}`}
      title={tooltip || config.defaultTooltip}
    >
      {showIcon && <Icon className={`${iconSizes[size]} shrink-0`} />}
      <span>{config.label}</span>
    </span>
  );
};
