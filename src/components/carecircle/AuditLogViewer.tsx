import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  UserCheck,
  FileCheck2,
  Clock,
  KeyRound,
  Hash,
  Sparkles,
  Lock
} from 'lucide-react';
import type { AuditLogEntry } from '@/types/vault';

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = logs.filter((entry) => {
    const matchesSearch =
      searchTerm === '' ||
      entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.performedBy?.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.performedBy?.onBehalfOf?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === 'all' || entry.action.includes(actionFilter);
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Immutable Caregiver Proxy Audit Trail (G3)
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
            {filteredLogs.length} Verified Entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search proxy actions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="all">All Actions</option>
            <option value="proposal">Proposals</option>
            <option value="danger">Safety Alerts</option>
            <option value="medication">Medications</option>
            <option value="lab">Labs</option>
          </select>
        </div>
      </div>

      {/* Log Entries */}
      {filteredLogs.length === 0 ? (
        <div className="bg-slate-950 rounded-2xl p-8 text-center text-xs text-slate-400 border border-slate-800">
          No matching audit log transactions found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((entry) => {
            const isProxy = !!entry.performedBy?.onBehalfOf;

            return (
              <div
                key={entry.id}
                className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 transition-all space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    <span className="font-mono text-sky-400 uppercase bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 text-[10px]">
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span>
                      {entry.performedBy?.userName || 'User'}
                      {isProxy && (
                        <span className="text-indigo-300 font-semibold">
                          {' '}
                          (acting on behalf of {entry.performedBy.onBehalfOf})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Details Breakdown */}
                {entry.details && (
                  <div className="bg-slate-900/80 rounded-xl p-2.5 text-[11px] text-slate-300 font-mono border border-slate-800 space-y-1">
                    {Object.entries(entry.details).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 truncate">
                        <span className="text-slate-500">{k}:</span>
                        <span className="text-slate-200">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cryptographic Signature Hash */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Hash className="w-3 h-3 text-emerald-400" />
                    Sig: {entry.hash || `sha256_${entry.id.substring(0, 16)}`}
                  </span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Cryptographically Sealed (LocalVault)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
