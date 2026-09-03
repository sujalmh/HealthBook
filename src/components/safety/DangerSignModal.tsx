import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Heart,
  Camera,
  Activity,
  ShieldAlert,
  Send,
  Sparkles,
  CheckCircle2,
  Info,
  PhoneCall
} from 'lucide-react';
import type { DangerSymptomTag } from '@/types/safety';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import { ModalPortal } from '../common/ModalPortal';

interface DangerSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
  };
  onReportSubmitted?: () => void;
}

const AVAILABLE_SYMPTOMS: { tag: DangerSymptomTag; label: string; urgent?: boolean }[] = [
  { tag: 'edema_feet', label: 'Swollen feet / Ankle Edema', urgent: true },
  { tag: 'dyspnea', label: 'Shortness of breath / Breathing Difficulty', urgent: true },
  { tag: 'chest_pain', label: 'Chest pain / Pressure', urgent: true },
  { tag: 'dizziness', label: 'Severe dizziness / Fainting' },
  { tag: 'bleeding_bruising', label: 'Unexplained bleeding / Bruising', urgent: true },
  { tag: 'confusion', label: 'Confusion / Altered State', urgent: true },
  { tag: 'headache', label: 'Sudden severe headache' },
  { tag: 'vision_changes', label: 'Blurred / Vision Changes' },
  { tag: 'shakiness', label: 'Shakiness / Cold Sweats' },
  { tag: 'sweating', label: 'Profuse sweating' }
];

export const DangerSignModal: React.FC<DangerSignModalProps> = ({
  isOpen,
  onClose,
  patientId,
  activeProfile,
  onReportSubmitted
}) => {
  const effectivePatientId = resolvePatientId(patientId);
  const callerRole = (activeProfile as unknown as { role?: string })?.role || 'patient';
  const callerPermission = (activeProfile as unknown as { permissionLevel?: string })?.permissionLevel || 'manage';
  const isViewOnly = callerPermission === 'view_only';
  const [selectedTags, setSelectedTags] = useState<DangerSymptomTag[]>(['edema_feet', 'dyspnea']);
  const [freeText, setFreeText] = useState(
    'Sudden bilateral ankle swelling and shortness of breath when climbing stairs since yesterday.'
  );
  const [severityRating, setSeverityRating] = useState<'mild' | 'moderate' | 'severe' | 'critical'>('severe');
  const [systolicBP, setSystolicBP] = useState('185');
  const [diastolicBP, setDiastolicBP] = useState('105');
  const [heartRate, setHeartRate] = useState('92');
  const [hasPhoto, setHasPhoto] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleSymptom = (tag: DangerSymptomTag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const isEmergency =
    selectedTags.includes('chest_pain') ||
    selectedTags.includes('dyspnea') ||
    severityRating === 'critical' ||
    (parseInt(systolicBP) >= 180 && parseInt(diastolicBP) >= 110);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTags.length === 0) return;
    if (isViewOnly) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Permission denied: View-only cannot report danger signs (PERMISSION_DENIED)' });
      return;
    }

    setIsSubmitting(true);
    try {

      const callerForAudit = activeProfile || { userId: effectivePatientId, name: 'Patient', role: 'patient', isProxy: false, permissionLevel: 'manage' as const };
      const ca = callerForAudit as unknown as { userId?: string; name?: string; role?: string; isProxy?: boolean; permissionLevel?: string; onBehalfOf?: string };
      const auditProfile = {
        userId: ca.userId || effectivePatientId,
        name: ca.name || 'Patient',
        role: (ca.role as "patient" | "caregiver" | "doctor") || 'patient',
        isProxy: !!ca.isProxy,
        permissionLevel: ca.permissionLevel || 'manage',
        onBehalfOf: ca.onBehalfOf
      } as unknown as { userId: string; name: string; role: "patient" | "caregiver" | "doctor"; isProxy: boolean; permissionLevel: "view_only" | "manage" | "full"; onBehalfOf?: string };
      const hasVisionPhoto = hasPhoto;

      const visionDataUrl = hasVisionPhoto ? 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD' : undefined;

      const reportRes = await webMCPEngine.execute(
        'report_danger_sign',
        {
          symptomTags: selectedTags,
          freeText,
          severityRating,
          vitalSigns: {
            systolicBP: parseInt(systolicBP) || undefined,
            diastolicBP: parseInt(diastolicBP) || undefined,
            heartRate: parseInt(heartRate) || undefined
          },
          photoBlob: visionDataUrl || (hasPhoto ? 'clinical_photo.jpg' : undefined)
        },
        {
          patientId: effectivePatientId,
          activeProfile: auditProfile,
          vault: localVault,
          eventBus
        }
      );

      await webMCPEngine.execute(
        'notify_doctor',
        {
          priority: isEmergency ? 'EMERGENCY' : 'URGENT',
          alertPayload: {
            reportId: reportRes.data?.reportId,
            symptoms: selectedTags,
            vitals: { BP: `${systolicBP}/${diastolicBP}`, HR: heartRate }
          }
        },
        {
          patientId: effectivePatientId,
          activeProfile: auditProfile,
          vault: localVault,
          eventBus
        }
      );

      eventBus.dispatchToast({
        type: isEmergency ? 'warning' : 'info',
        title: 'Danger Sign Escalated',
        message: isEmergency
          ? 'Urgent alert dispatched to your care team. If symptoms worsen, call 911.'
          : 'Report sent to clinical triage queue.'
      });

      eventBus.emit('danger_reported', { patientId: effectivePatientId, report: (reportRes as unknown as { data?: { reportId?: string } }).data });
      if (onReportSubmitted) onReportSubmitted();
      onClose();
    } catch {

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} ariaLabel="Report red-flag danger signs">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mx-auto">
        {}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-canvas-border bg-rose-50 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-clinical-red flex items-center justify-center border border-rose-200 shadow-sm shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-heading-md text-slate-900 truncate">Report red-flag danger signs</h3>
              <p className="text-body-sm text-clinical-red line-clamp-1">Immediate clinical escalation & doctor notification</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Close danger sign modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {}
        {isEmergency && (
          <div className="bg-rose-600 px-6 py-3 text-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
              <span>
                CRITICAL WARNING: If you experience crushing chest pain, difficulty speaking, or severe breathing distress, call 911 immediately.
              </span>
            </div>
            <a
              href="tel:911"
              className="px-3 py-1 bg-white text-rose-700 rounded-xl text-xs font-bold shrink-0 hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call 911</span>
            </a>
          </div>
        )}

        {}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Observed Red-Flag Symptoms
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_SYMPTOMS.map((s) => {
                const isSelected = selectedTags.includes(s.tag);
                return (
                  <button
                    key={s.tag}
                    type="button"
                    onClick={() => toggleSymptom(s.tag)}
                    className={`flex items-center justify-between p-3 rounded-xl text-body-sm font-semibold border transition-all text-left min-h-[44px] ${
                      isSelected
                        ? 'bg-rose-50 border-rose-200 text-clinical-red shadow-sm'
                        : 'bg-canvas-card border-canvas-border text-muted hover:text-slate-900'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Self-Assessed Severity</label>
              <select
                value={severityRating}
                onChange={(e) => setSeverityRating(e.target.value as unknown as typeof severityRating)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold min-h-[44px]"
              >
                <option value="mild">Mild (Noticeable but stable)</option>
                <option value="moderate">Moderate (Interferes with activity)</option>
                <option value="severe">Severe (Urgent clinician review needed)</option>
                <option value="critical">Critical / Emergency (Immediate)</option>
              </select>
            </div>

            {}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Current Blood Pressure & Pulse</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Sys"
                  value={systolicBP}
                  onChange={(e) => setSystolicBP(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-center text-rose-700 font-bold min-w-0 w-full min-h-[44px]"
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={diastolicBP}
                  onChange={(e) => setDiastolicBP(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-center text-rose-700 font-bold min-w-0 w-full min-h-[44px]"
                />
                <input
                  type="number"
                  placeholder="HR bpm"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-center text-sky-700 font-bold min-w-0 w-full min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Detailed Symptom Description</label>
            <textarea
              rows={2}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed placeholder-slate-500"
              placeholder="Describe when symptoms started, location, and triggers..."
            />
          </div>

          {}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-800">Attach Clinical Photo</div>
                <div className="text-slate-600 text-[11px]">
                  {hasPhoto ? 'Photo attached: ankle_edema_feet.jpg' : 'No photo attached'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHasPhoto(!hasPhoto)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors min-h-[44px] flex items-center justify-center ${
                hasPhoto
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {hasPhoto ? 'Attached (ankle_edema.jpg)' : 'Attach Photo'}
            </button>
          </div>
        </form>

        {}
        <div className="px-4 sm:px-6 py-4 border-t border-canvas-border bg-canvas-muted flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors min-h-[44px] flex items-center justify-center"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedTags.length === 0 || isViewOnly}
            aria-disabled={isViewOnly}
            title={isViewOnly ? 'View-only: cannot dispatch — Permission denied (PERMISSION_DENIED)' : undefined}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-lg min-h-[44px] ${isViewOnly ? 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none' : 'bg-rose-600 hover:bg-rose-500'}`}
          >
            <Send className="w-4 h-4" />
            <span>{isViewOnly ? 'View-only blocked (PERMISSION_DENIED)' : isSubmitting ? 'Dispatching...' : 'Dispatch Alert to Your Doctor'}</span>
          </button>
          {isViewOnly && <p className="text-caption text-amber-700 font-semibold w-full text-center sm:text-right">View-only: cannot report danger signs — PERMISSION_DENIED</p>}
        </div>
      </div>
    </ModalPortal>
  );
};

