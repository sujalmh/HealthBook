/**
 * CareCanvas Component: ThreeListTable
 * Side-by-side comparative table of Pre-admission vs In-Hospital vs Discharge medications
 * with color-coded diff highlights, search/filtering, and quick actions.
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Check,
  AlertCircle,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Utensils,
  ChevronRight,
  Info
} from 'lucide-react';
import type {
  ReconciledMedChangeItem,
  ReconciliationFilter,
  ChangeStatusBadge
} from '../../types/rxbridge.ts';
import { ChangeBadge } from './ChangeBadge.tsx';

interface ThreeListTableProps {
  items: ReconciledMedChangeItem[];
  onSelectMed: (item: ReconciledMedChangeItem) => void;
  onToggleApproval: (medId: string) => void;
  onAskDoctor: (medName: string, context: string) => void;
}

export const ThreeListTable: React.FC<ThreeListTableProps> = ({
  items,
  onSelectMed,
  onToggleApproval,
  onAskDoctor
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReconciliationFilter>('ALL');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.medName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.documentedReason && item.documentedReason.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === 'ALL') return true;
      return item.statusBadge === filterStatus;
    });
  }, [items, searchQuery, filterStatus]);

  const counts = useMemo(() => {
    return {
      ALL: items.length,
      NEW: items.filter((i) => i.statusBadge === 'NEW').length,
      DOSE_CHANGED: items.filter((i) => i.statusBadge === 'DOSE_CHANGED').length,
      STOPPED: items.filter((i) => i.statusBadge === 'STOPPED').length,
      CONTINUED: items.filter((i) => i.statusBadge === 'CONTINUED').length,
      HELD_AND_RESUMED: items.filter((i) => i.statusBadge === 'HELD_AND_RESUMED').length
    };
  }, [items]);

  const getRowBgClass = (status: ChangeStatusBadge) => {
    switch (status) {
      case 'NEW':
        return 'hover:bg-purple-50 bg-purple-50/50 border-l-4 border-l-purple-500';
      case 'DOSE_CHANGED':
        return 'hover:bg-sky-50 bg-sky-50/50 border-l-4 border-l-sky-500';
      case 'STOPPED':
        return 'hover:bg-rose-50 bg-rose-50/70 border-l-4 border-l-clinical-red opacity-95';
      case 'HELD_AND_RESUMED':
        return 'hover:bg-amber-50 bg-amber-50/50 border-l-4 border-l-clinical-amber';
      case 'CONTINUED':
      default:
        return 'hover:bg-emerald-50 bg-canvas-muted border-l-4 border-l-clinical-emerald/60';
    }
  };

  return (
    <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-heading-md text-slate-900 flex items-center gap-2">
            <span>3-list comparative reconciliation table</span>
            <span className="text-caption px-2 py-0.5 rounded-full bg-canvas-muted text-muted font-mono border border-canvas-border">
              {filteredItems.length} of {items.length} items
            </span>
          </h3>
          <p className="text-body-sm text-muted mt-0.5">
            Side-by-side verification of pre-admission (home), in-hospital chart, and final discharge orders.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search med or reason..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-canvas-muted border border-canvas-border text-body-sm text-slate-900 placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-canvas-border pb-3">
        {(
          [
            { id: 'ALL', label: 'All Medications' },
            { id: 'NEW', label: 'New' },
            { id: 'DOSE_CHANGED', label: 'Dose Changed' },
            { id: 'STOPPED', label: 'Stopped' },
            { id: 'CONTINUED', label: 'Continued' },
            { id: 'HELD_AND_RESUMED', label: 'Held & Resumed' }
          ] as { id: ReconciliationFilter; label: string }[]
        ).map((tab) => {
          const count = counts[tab.id];
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-sky-700 text-white' : 'bg-canvas-muted text-muted border border-canvas-border'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-canvas-border bg-canvas-muted/50">
        <table className="w-full text-left border-collapse text-body-sm">
          <thead>
            <tr className="bg-canvas-muted border-b border-canvas-border text-muted font-bold uppercase tracking-wider text-caption">
              <th className="py-3 px-4 w-12 text-center">Status</th>
              <th className="py-3 px-4 min-w-[180px]">Medication</th>
              <th className="py-3 px-4 min-w-[160px] bg-white/30">1. Pre-Admission (Home)</th>
              <th className="py-3 px-4 min-w-[190px]">2. In-Hospital Record</th>
              <th className="py-3 px-4 min-w-[220px] bg-white/30">3. Discharge Orders</th>
              <th className="py-3 px-4 min-w-[140px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-canvas-border">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-600">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  No medications found matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.medId}
                  className={`transition-colors cursor-pointer ${getRowBgClass(item.statusBadge)}`}
                  onClick={() => onSelectMed(item)}
                >
                  {/* Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <ChangeBadge status={item.statusBadge} size="sm" />
                  </td>

                  {/* Medication Name & Crosswalk */}
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{item.medName}</span>
                      {item.isOTC && (
                        <span className="text-caption px-1.5 py-0.5 rounded bg-amber-50 text-clinical-amber font-mono border border-amber-200">
                          OTC
                        </span>
                      )}
                    </div>
                    <div className="text-caption text-muted font-mono">
                      {item.genericName !== item.medName ? `Generic: ${item.genericName}` : 'Rx'}
                    </div>

                    {/* Quick Warning Chips */}
                    {item.interactions && item.interactions.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-700">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">Conflict with {item.interactions[0].drugB}</span>
                      </div>
                    )}
                    {item.dietInteractions && item.dietInteractions.length > 0 && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-700">
                        <Utensils className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{item.dietInteractions[0].badge}</span>
                      </div>
                    )}
                  </td>

                  {/* List 1: Pre-Admission Home Regimen */}
                  <td className="py-3.5 px-4 bg-white/20">
                    <div className="font-semibold text-slate-800">
                      {item.preHospDose !== 'None' ? item.preHospDose : <span className="text-slate-600 italic">None (Not taken at home)</span>}
                    </div>
                    {item.preHospFrequency && (
                      <div className="text-[11px] text-slate-600">{item.preHospFrequency}</div>
                    )}
                  </td>

                  {/* List 2: In-Hospital Chart Action */}
                  <td className="py-3.5 px-4">
                    <div className="text-slate-800 font-medium">{item.inHospAction}</div>
                    {item.inHospReason && (
                      <div className="text-[11px] text-slate-600 italic mt-0.5">{item.inHospReason}</div>
                    )}
                  </td>

                  {/* List 3: Discharge Orders */}
                  <td className="py-3.5 px-4 bg-white/20">
                    <div
                      className={`font-bold text-sm ${
                        item.statusBadge === 'STOPPED'
                          ? 'text-clinical-red line-through'
                          : item.statusBadge === 'NEW'
                          ? 'text-clinical-purple'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.dischargeDose}
                    </div>
                    {item.dischargeFrequency && (
                      <div className="text-[11px] text-slate-700">{item.dischargeFrequency}</div>
                    )}
                    {item.documentedReason && (
                      <div className="text-[10px] text-slate-600 mt-1 flex items-start gap-1">
                        <Info className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                        <span>{item.documentedReason}</span>
                      </div>
                    )}
                  </td>

                  {/* Actions Column */}
                  <td className="py-3.5 px-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleApproval(item.medId)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-all ${
                        item.isApprovedByPatient
                          ? 'bg-emerald-600/30 text-emerald-700 border border-emerald-500/50 hover:bg-emerald-600/40'
                          : 'bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title={item.isApprovedByPatient ? 'Change approved by patient' : 'Click to approve this medication'}
                    >
                      <Check className={`w-3.5 h-3.5 ${item.isApprovedByPatient ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span>{item.isApprovedByPatient ? 'Approved' : 'Review'}</span>
                    </button>

                    <button
                      onClick={() => onSelectMed(item)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-sky-600/30 hover:text-sky-700 text-slate-600 border border-slate-200 transition-colors"
                      title="Open detailed reconciliation walkthrough card"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
