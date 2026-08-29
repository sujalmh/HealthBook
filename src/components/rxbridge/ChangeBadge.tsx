/**
 * CareCanvas Component: ChangeBadge
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
          bgClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30',
          dotClass: 'bg-purple-400 shadow-purple-400/50',
          defaultTooltip: 'Brand new medication started in hospital or on discharge.'
        };
      case 'DOSE_CHANGED':
        return {
          label: customLabel || 'DOSE CHANGED',
          icon: ArrowUpDown,
          bgClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30',
          dotClass: 'bg-sky-400 shadow-sky-400/50',
          defaultTooltip: 'Dose, frequency, or administration route was modified.'
        };
      case 'STOPPED':
        return {
          label: customLabel || 'STOPPED',
          icon: XOctagon,
          bgClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30',
          dotClass: 'bg-rose-400 shadow-rose-400/50',
          defaultTooltip: 'Medication discontinued in hospital. Do NOT take old supply.'
        };
      case 'HELD_AND_RESUMED':
        return {
          label: customLabel || 'HELD & RESUMED',
          icon: RotateCcw,
          bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
          dotClass: 'bg-amber-400 shadow-amber-400/50',
          defaultTooltip: 'Temporarily paused during inpatient stay, now resumed at home dose.'
        };
      case 'CONTINUED':
      default:
        return {
          label: customLabel || 'CONTINUED',
          icon: CheckCircle2,
          bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
          dotClass: 'bg-emerald-400 shadow-emerald-400/50',
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
