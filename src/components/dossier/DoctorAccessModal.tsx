import React, { useState } from 'react';
import {
  KeyRound,
  Shield,
  Clock,
  UserCheck,
  Lock,
  Copy,
  Check,
  AlertTriangle,
  Mail,
  ShieldAlert,
  Trash2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import type { DoctorAccessGrant } from '@/types/carecircle';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';

interface DoctorAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  grants: DoctorAccessGrant[];
  onGrantsUpdated: () => void;
}

export const DoctorAccessModal: React.FC<DoctorAccessModalProps> = ({
  isOpen,
  onClose,
  patientId,
  grants,
  onGrantsUpdated
}) => {
  const [doctorEmail, setDoctorEmail] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [scope, setScope] = useState<'full_dossier' | 'snapshot_only' | 'labs_and_meds'>('full_dossier');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorEmail.trim()) return;

    setIsGenerating(true);
    try {
      const res = await webMCPEngine.execute(
        'grant_doctor_access',
        {
          doctorEmail: doctorEmail.trim(),
          durationDays,
          scope,
          patientId
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'success',
          title: 'Access Token Generated',
          message: `Created ${durationDays}-day secure access token for ${doctorEmail}.`
        });
        setDoctorEmail('');
        onGrantsUpdated();
      } else {
        eventBus.dispatchToast({
          type: 'error',
          title: 'Grant Failed',
          message: res.error?.message || 'Failed to create doctor access token.'
        });
      }
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Execution Error',
        message: err.message || 'Failed to execute grant_doctor_access.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    try {
      const res = await webMCPEngine.execute(
        'revoke_access',
        { grantId }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'info',
          title: 'Access Revoked',
          message: `Doctor access grant "${grantId}" was immediately invalidated.`
        });
        onGrantsUpdated();
      }
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Revocation Error',
        message: err.message || 'Failed to revoke token.'
      });
    }
  };

  const handleCopyToken = (tokenId: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-2xl w-full p-4 sm:p-8 shadow-xl space-y-5 sm:space-y-6 text-slate-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-heading-lg text-slate-900 truncate">Clinician handover delegation</h3>
                <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border uppercase shrink-0">
                  CD4 secure access
                </span>
              </div>
              <p className="text-body-sm text-muted line-clamp-1">
                Grant time-bound access tokens to new physicians with zero cloud storage and instant 1-click revocation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted hover:text-slate-900 transition-colors flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Close doctor access modal"
          >
            ✕
          </button>
        </div>

        {/* Create Grant Form — tokenized */}
        <form onSubmit={handleGenerateGrant} className="bg-canvas-muted rounded-xl p-4 sm:p-5 border border-canvas-border space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Generate Time-Bound Access Passkey
          </h4>

          {/* Clinician Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Clinician Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={doctorEmail}
                onChange={(e) => setDoctorEmail(e.target.value)}
                placeholder="e.g. dr.chen@nephrology.org or dr.sharma@clinic.com"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors min-h-[44px]"
              />
            </div>
          </div>

          {/* Duration Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Access Duration Window</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { days: 7, label: '7 Days (Standard)' },
                { days: 30, label: '30 Days (Follow-up)' },
                { days: 365, label: '1 Year (Primary Care)' }
              ].map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setDurationDays(preset.days)}
                  className={`py-2.5 px-3 rounded-xl text-body-sm font-bold transition-all min-h-[44px] flex items-center justify-center ${
                    durationDays === preset.days
                      ? 'bg-primary text-white shadow-sm border border-primary'
                      : 'bg-canvas-card text-muted hover:text-slate-900 border border-canvas-border'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Access Scope Tier</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors min-h-[44px]"
            >
              <option value="full_dossier">Full Continuity Dossier (Labs, Meds, Notes, BBoxes)</option>
              <option value="snapshot_only">Emergency Snapshot Only (Vitals, Allergies, Active Meds)</option>
              <option value="labs_and_meds">Labs & Medication History Only</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isGenerating || !doctorEmail.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? 'Generating...' : `Generate ${durationDays}-Day Access Token`}</span>
          </button>
        </form>

        {/* Active Grants List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Active Clinician Grants ({grants.length})
            </h4>
            <span className="text-[10px] text-slate-600">Subject to Immediate Patient Revocation</span>
          </div>

          {grants.length === 0 ? (
            <div className="bg-canvas-muted rounded-xl p-6 border border-canvas-border text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-canvas-card text-muted flex items-center justify-center mx-auto border border-canvas-border">
                <KeyRound className="w-5 h-5" />
              </div>
              <p className="text-body-sm font-bold text-slate-900">No doctors shared with yet</p>
              <p className="text-body-sm text-muted">When you want to share, add a doctor above — you can remove access anytime.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grants.map((grant) => {
                const isRevoked = grant.status === 'revoked';
                const isExpired = new Date(grant.expiresAt).getTime() < Date.now();
                const isCopied = copiedTokenId === grant.grantId;

                return (
                  <div
                    key={grant.grantId}
                    className={`rounded-2xl p-4 border text-xs space-y-3 transition-colors ${
                      isRevoked || isExpired
                        ? 'bg-slate-50/50 border-slate-200/60 opacity-60'
                        : 'bg-slate-50 border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-slate-900 text-sm">{grant.doctorName || grant.doctorEmail}</h5>
                          <span
                            className={`px-2 py-0.2 rounded text-[9px] font-bold uppercase ${
                              isRevoked
                                ? 'bg-rose-500/20 text-rose-700'
                                : isExpired
                                ? 'bg-amber-500/20 text-amber-700'
                                : 'bg-emerald-500/20 text-emerald-700'
                            }`}
                          >
                            {grant.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-mono">{grant.doctorEmail}</p>
                      </div>

                      {!isRevoked && !isExpired && (
                        <button
                          onClick={() => handleRevokeGrant(grant.grantId)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 font-bold text-xs border border-rose-500/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke Access</span>
                        </button>
                      )}
                    </div>

                    {/* Token Display & Expiration Details */}
                    <div className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 truncate">
                        <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-[11px] text-slate-600 font-mono truncate">
                          Passkey: <strong className="text-slate-800">{grant.token || `cc_tok_${grant.grantId.slice(0, 8)}`}</strong>
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyToken(grant.grantId, grant.token || `cc_tok_${grant.grantId}`)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-700 text-xs font-semibold shrink-0"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono pt-1">
                      <span>Scope: <strong className="text-indigo-700 uppercase">{grant.scope}</strong></span>
                      <span>Expires: {new Date(grant.expiresAt).toLocaleDateString()} ({grant.durationDays} days)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
