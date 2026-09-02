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
  const [newPatientId, setNewPatientId] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [relationship, setRelationship] = useState<string>('mother');
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
    if (!caregiverName.trim() || caregiverName.trim().length < 2) {
      eventBus.dispatchToast({ type: 'warning', title: 'Name required', message: 'Please enter caregiver name (at least 2 characters).' });
      return;
    }
    setIsLinking(true);
    try {
      // 1. Link Patient — caregiverName passed to link_patient and vault 783
      const linkRes = await webMCPEngine.execute(
        'link_patient',
        {
          patientId: newPatientId,
          relationship,
          authToken,
          caregiverName: caregiverName.trim() || relationship
        },
        {
          patientId,
          activeProfile: { userId: 'user-family-member', name: 'Family member', role: 'caregiver', isProxy: true, permissionLevel: permissionTier },
          vault: localVault,
          eventBus
        }
      );

      // 2. Grant scoped permissions
      if (linkRes.success && linkRes.data) {
        await webMCPEngine.execute(
          'grant_caregiver_access',
          {
            caregiverId: 'user-family-member',
            permissionLevel: permissionTier,
            patientId: newPatientId
          },
          {
            patientId,
            activeProfile: { userId: 'user-family-member', name: 'Family member', role: 'caregiver', isProxy: true, permissionLevel: permissionTier },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-xl w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-canvas-border bg-canvas-card gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center border border-primary-border shadow-sm shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-heading-md text-slate-900 truncate">Caregiver permissions & linkages</h3>
              <p className="text-body-sm text-muted line-clamp-1">Manage scoped proxy access tiers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted hover:text-slate-900 flex items-center justify-center transition-colors shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Close scoped permissions modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="flex items-center bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm">
            <button
              onClick={() => setActiveTab('manage_existing')}
              className={`flex-1 py-2.5 rounded-xl font-bold transition-all min-h-[44px] flex items-center justify-center ${
                activeTab === 'manage_existing'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Active Caregivers ({caregiverLinks.length})
            </button>
            <button
              onClick={() => setActiveTab('link_new')}
              className={`flex-1 py-2.5 rounded-xl font-bold transition-all min-h-[44px] flex items-center justify-center ${
                activeTab === 'link_new'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:text-slate-800'
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
                <div className="bg-canvas-muted rounded-xl p-6 text-center space-y-3 border border-canvas-border">
                  <div className="w-10 h-10 rounded-xl bg-canvas-card text-muted flex items-center justify-center mx-auto border border-canvas-border">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <p className="text-body-sm font-bold text-slate-900">No helpers yet</p>
                  <p className="text-body-sm text-muted">Add a family member who helps with your health.</p>
                  <button
                    onClick={() => setActiveTab('link_new')}
                    className="inline-flex items-center gap-1.5 text-body-sm text-accent font-bold hover:underline"
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
                      className="bg-canvas-muted rounded-xl p-4 border border-canvas-border flex items-center justify-between gap-3 text-body-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {link.caregiverName || 'Family member'}
                          </span>
                          <span className="text-muted font-medium">({link.relationship || 'Son'})</span>
                          <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary-text text-caption font-bold border border-primary-border uppercase">
                            {link.permissionLevel || 'MANAGE'}
                          </span>
                        </div>
                        <p className="text-muted text-body-sm">
                          Can view labs, approve dosage changes, and upload slips on behalf.
                        </p>
                      </div>

                      <button
                        onClick={() => handleRevoke(link.linkId, link.caregiverId || link.caregiverUserId || 'user_family')}
                        className="p-2 rounded-xl bg-canvas-card hover:bg-rose-50 text-muted hover:text-clinical-red border border-canvas-border hover:border-rose-200 transition-colors"
                        title="Revoke caregiver access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Permission Tiers Explanation Card */}
              <div className="bg-canvas-muted rounded-xl p-4 border border-canvas-border space-y-2 text-body-sm">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-400" />
                  Understanding Caregiver Permission Tiers:
                </span>
                <div className="space-y-1.5 text-slate-600 text-[11px]">
                  <div>
                    <strong className="text-slate-800">View only:</strong> Can view lab trends, weekly pillbox, and calendar. Cannot approve changes or upload slips.
                  </div>
                  <div>
                    <strong className="text-slate-800">🛠️ Manage (Recommended):</strong> Can approve doctor dosage proposals, upload lab slips, and schedule follow-ups on behalf.
                  </div>
                  <div>
                    <strong className="text-slate-800">👑 Full:</strong> Full administrative control including doctor access token generation and export.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Link New Caregiver Form */
            <form onSubmit={handleLinkNew} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Patient ID to Link</label>
                <input
                  type="text"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  placeholder="e.g., patient-s-devi"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Name</label>
                <input
                  type="text"
                  value={caregiverName}
                  onChange={(e) => setCaregiverName(e.target.value)}
                  placeholder="e.g., Raj (son)"
                  required
                  minLength={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Family Member Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 min-h-[44px]"
                >
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                  <option value="children">Children</option>
                  <option value="husband">Husband</option>
                  <option value="wife">Wife</option>
                  <option value="partner">Partner</option>
                  <option value="brother">Brother</option>
                  <option value="sister">Sister</option>
                  <option value="guardian">Guardian</option>
                  <option value="advocate">Advocate</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Permission Scope Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['view_only', 'manage', 'full'] as CaregiverPermissionLevel[]).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setPermissionTier(tier)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all uppercase min-h-[44px] flex items-center justify-center ${
                        permissionTier === tier
                          ? 'bg-teal-700 border-teal-500 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {tier.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Authorization / Consent Token</label>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono min-h-[44px]"
                  placeholder="Enter patient authorization code..."
                />
              </div>

              <button
                type="submit"
                disabled={isLinking}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all min-h-[44px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLinking ? 'Linking...' : 'Grant & Link Caregiver (link_patient)'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-canvas-border bg-canvas-muted flex items-center justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-canvas-card hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors min-h-[44px] flex items-center justify-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
