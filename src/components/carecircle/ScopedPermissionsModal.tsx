import React, { useState } from 'react';
import {
  X,
  Shield,
  UserPlus,
  Trash2,
  CheckCircle2,
  Lock,
  Eye,
  KeyRound,
  Sparkles,
  Info,
  UserCheck
} from 'lucide-react';
import type { CaregiverPermissionLevel, LinkedCareProfile } from '@/types/carecircle';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface ScopedPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  onPermissionsUpdated?: () => void;
}

export const ScopedPermissionsModal: React.FC<ScopedPermissionsModalProps> = ({
  isOpen,
  onClose,
  patientId,
  onPermissionsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'manage_existing' | 'link_new'>('manage_existing');

  // Link New Form
  const [newPatientId, setNewPatientId] = useState('patient-s-devi');
  const [relationship, setRelationship] = useState<'parent' | 'child' | 'spouse' | 'guardian' | 'advocate'>('parent');
  const [authToken, setAuthToken] = useState('token_auth_valid_8923');
  const [permissionTier, setPermissionTier] = useState<CaregiverPermissionLevel>('manage');
  const [isLinking, setIsLinking] = useState(false);

  // Existing Caregivers
  const [caregiverLinks, setCaregiverLinks] = useState<LinkedCareProfile[]>(() =>
    localVault.getCaregiverLinks(patientId)
  );

  if (!isOpen) return null;

  const handleLinkNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLinking(true);
    try {
      // 1. Link Patient
      const linkRes = await webMCPEngine.execute(
        'link_patient',
        {
          patientId: newPatientId,
          relationship,
          authToken
        },
        {
          patientId,
          activeProfile: { userId: 'user-raj-devi', name: 'Raj Devi', role: 'caregiver', isProxy: true, permissionLevel: permissionTier },
          vault: localVault,
          eventBus
        }
      );

      // 2. Grant scoped permissions
      if (linkRes.success && linkRes.data) {
        await webMCPEngine.execute(
          'grant_caregiver_access',
          {
            caregiverId: 'user-raj-devi',
            permissionLevel: permissionTier,
            patientId: newPatientId
          },
          {
            patientId,
            activeProfile: { userId: 'user-raj-devi', name: 'Raj Devi', role: 'caregiver', isProxy: true, permissionLevel: permissionTier },
            vault: localVault,
            eventBus
          }
        );
      }

      eventBus.dispatchToast({
        type: 'success',
        title: 'Caregiver Linked',
        message: `Successfully linked profile with "${permissionTier.toUpperCase()}" permissions.`
      });

      setCaregiverLinks(localVault.getCaregiverLinks(patientId));
      if (onPermissionsUpdated) onPermissionsUpdated();
      setActiveTab('manage_existing');
    } catch (err) {
      console.error('Error linking patient:', err);
    } finally {
      setIsLinking(false);
    }
  };

  const handleRevoke = async (linkId: string, caregiverId: string) => {
    try {
      await webMCPEngine.execute(
        'revoke_caregiver_access',
        { caregiverId, patientId },
        {
          patientId,
          activeProfile: { userId: patientId, name: 'Patient', role: 'patient', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      const link = localVault.careCircle.get(linkId);
      if (link) {
        link.status = 'revoked';
      }

      eventBus.dispatchToast({
        type: 'info',
        title: 'Access Revoked',
        message: 'Caregiver proxy permissions have been immediately revoked.'
      });

      setCaregiverLinks(localVault.getCaregiverLinks(patientId));
      if (onPermissionsUpdated) onPermissionsUpdated();
    } catch (err) {
      console.error('Error revoking access:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Caregiver Permissions & Linkages</h3>
              <p className="text-xs text-slate-400">Manage scoped proxy access tiers (G1 – G4)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-4">
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('manage_existing')}
              className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'manage_existing'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Caregivers ({caregiverLinks.length})
            </button>
            <button
              onClick={() => setActiveTab('link_new')}
              className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'link_new'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              + Link New Caregiver
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'manage_existing' ? (
            <div className="space-y-4">
              {caregiverLinks.length === 0 ? (
                <div className="bg-slate-950 rounded-2xl p-6 text-center space-y-3 border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-200">No helpers yet</p>
                  <p className="text-xs text-slate-400">Add a family member who helps with your health.</p>
                  <button
                    onClick={() => setActiveTab('link_new')}
                    className="inline-flex items-center gap-1.5 text-xs text-sky-400 font-bold hover:underline"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add a helper
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {caregiverLinks.map((link) => (
                    <div
                      key={link.linkId}
                      className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">
                            {link.caregiverName || 'Raj Devi'}
                          </span>
                          <span className="text-slate-500 font-medium">({link.relationship || 'Son'})</span>
                          <span className="px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 uppercase">
                            {link.permissionLevel || 'MANAGE'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Can view labs, approve dosage changes, and upload slips on behalf.
                        </p>
                      </div>

                      <button
                        onClick={() => handleRevoke(link.linkId, link.caregiverId || link.caregiverUserId || 'user_raj_son')}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 transition-colors"
                        title="Revoke caregiver access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Permission Tiers Explanation Card */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-400" />
                  Understanding Caregiver Permission Tiers:
                </span>
                <div className="space-y-1.5 text-slate-400 text-[11px]">
                  <div>
                    <strong className="text-slate-200">👁️ View Only:</strong> Can view lab trends, weekly pillbox, and calendar. Cannot approve changes or upload slips.
                  </div>
                  <div>
                    <strong className="text-slate-200">🛠️ Manage (Recommended):</strong> Can approve doctor dosage proposals, upload lab slips, and schedule follow-ups on behalf.
                  </div>
                  <div>
                    <strong className="text-slate-200">👑 Full:</strong> Full administrative control including doctor access token generation and export.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Link New Caregiver Form */
            <form onSubmit={handleLinkNew} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Family Member Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="parent">Parent (Mother / Father)</option>
                  <option value="child">Child (Son / Daughter)</option>
                  <option value="spouse">Spouse / Partner</option>
                  <option value="guardian">Legal Guardian</option>
                  <option value="advocate">Healthcare Advocate</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Permission Scope Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['view_only', 'manage', 'full'] as CaregiverPermissionLevel[]).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setPermissionTier(tier)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all uppercase ${
                        permissionTier === tier
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {tier.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Authorization / Consent Token</label>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                  placeholder="Enter patient authorization code..."
                />
              </div>

              <button
                type="submit"
                disabled={isLinking}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-sky-600/20"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLinking ? 'Linking...' : 'Grant & Link Caregiver (link_patient)'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
