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
        return 'hover:bg-purple-950/20 bg-purple-950/5 border-l-4 border-l-purple-500';
      case 'DOSE_CHANGED':
        return 'hover:bg-sky-950/20 bg-sky-950/5 border-l-4 border-l-sky-500';
      case 'STOPPED':
        return 'hover:bg-rose-950/20 bg-rose-950/10 border-l-4 border-l-rose-500 opacity-80';
      case 'HELD_AND_RESUMED':
        return 'hover:bg-amber-950/20 bg-amber-950/5 border-l-4 border-l-amber-500';
      case 'CONTINUED':
      default:
        return 'hover:bg-emerald-950/10 bg-slate-900/40 border-l-4 border-l-emerald-500/60';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>3-List Comparative Reconciliation Table</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {filteredItems.length} of {items.length} items
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Side-by-side verification of Pre-Admission (Home), In-Hospital Chart, and Final Discharge Orders.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search med or reason..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
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
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-sky-800 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/50">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-12 text-center">Status</th>
              <th className="py-3 px-4 min-w-[180px]">Medication</th>
              <th className="py-3 px-4 min-w-[160px] bg-slate-900/30">1. Pre-Admission (Home)</th>
              <th className="py-3 px-4 min-w-[190px]">2. In-Hospital Record</th>
              <th className="py-3 px-4 min-w-[220px] bg-slate-900/30">3. Discharge Orders</th>
              <th className="py-3 px-4 min-w-[140px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
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
                    <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                      <span>{item.medName}</span>
                      {item.isOTC && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                          OTC
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {item.genericName !== item.medName ? `Generic: ${item.genericName}` : 'Rx'}
                    </div>

                    {/* Quick Warning Chips */}
                    {item.interactions && item.interactions.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-300">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">Conflict with {item.interactions[0].drugB}</span>
                      </div>
                    )}
                    {item.dietInteractions && item.dietInteractions.length > 0 && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-300">
                        <Utensils className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{item.dietInteractions[0].badge}</span>
                      </div>
                    )}
                  </td>

                  {/* List 1: Pre-Admission Home Regimen */}
                  <td className="py-3.5 px-4 bg-slate-900/20">
                    <div className="font-semibold text-slate-200">
                      {item.preHospDose !== 'None' ? item.preHospDose : <span className="text-slate-500 italic">None (Not taken at home)</span>}
                    </div>
                    {item.preHospFrequency && (
                      <div className="text-[11px] text-slate-400">{item.preHospFrequency}</div>
                    )}
                  </td>

                  {/* List 2: In-Hospital Chart Action */}
                  <td className="py-3.5 px-4">
                    <div className="text-slate-200 font-medium">{item.inHospAction}</div>
                    {item.inHospReason && (
                      <div className="text-[11px] text-slate-400 italic mt-0.5">{item.inHospReason}</div>
                    )}
                  </td>

                  {/* List 3: Discharge Orders */}
                  <td className="py-3.5 px-4 bg-slate-900/20">
                    <div
                      className={`font-bold text-sm ${
                        item.statusBadge === 'STOPPED'
                          ? 'text-rose-400 line-through'
                          : item.statusBadge === 'NEW'
                          ? 'text-purple-300'
                          : 'text-slate-100'
                      }`}
                    >
                      {item.dischargeDose}
                    </div>
                    {item.dischargeFrequency && (
                      <div className="text-[11px] text-slate-300">{item.dischargeFrequency}</div>
                    )}
                    {item.documentedReason && (
                      <div className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
                        <Info className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
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
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                      title={item.isApprovedByPatient ? 'Change approved by patient' : 'Click to approve this medication'}
                    >
                      <Check className={`w-3.5 h-3.5 ${item.isApprovedByPatient ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{item.isApprovedByPatient ? 'Approved' : 'Review'}</span>
                    </button>

                    <button
                      onClick={() => onSelectMed(item)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-sky-600/30 hover:text-sky-300 text-slate-400 border border-slate-700 transition-colors"
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
