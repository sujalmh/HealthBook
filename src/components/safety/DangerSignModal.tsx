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

interface DangerSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  onReportSubmitted?: () => void;
}

const AVAILABLE_SYMPTOMS: { tag: DangerSymptomTag; label: string; urgent?: boolean }[] = [
  { tag: 'edema_feet', label: '🦶 Swollen Feet / Ankle Edema', urgent: true },
  { tag: 'dyspnea', label: '🫁 Shortness of Breath / Breathing Difficulty', urgent: true },
  { tag: 'chest_pain', label: '💔 Chest Pain / Pressure', urgent: true },
  { tag: 'dizziness', label: '💫 Severe Dizziness / Fainting' },
  { tag: 'bleeding_bruising', label: '🩸 Unexplained Bleeding / Bruising', urgent: true },
  { tag: 'confusion', label: '🧠 Confusion / Altered State', urgent: true },
  { tag: 'headache', label: '🤕 Sudden Severe Headache' },
  { tag: 'vision_changes', label: '👁️ Blurred / Vision Changes' },
  { tag: 'shakiness', label: '🫨 Shakiness / Cold Sweats' },
  { tag: 'sweating', label: '💦 Profuse Sweating' }
];

export const DangerSignModal: React.FC<DangerSignModalProps> = ({
  isOpen,
  onClose,
  patientId,
  onReportSubmitted
}) => {
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

    setIsSubmitting(true);
    try {
      // 1. Report Danger Sign
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
          photoBlob: hasPhoto ? 'mock_photo_ankle_edema.jpg' : undefined
        },
        {
          patientId,
          activeProfile: { userId: patientId, name: 'Patient', role: 'patient', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      // 2. Dispatch Doctor Triage Notification
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
          patientId,
          activeProfile: { userId: patientId, name: 'Patient', role: 'patient', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      eventBus.dispatchToast({
        type: isEmergency ? 'warning' : 'info',
        title: 'Danger Sign Escalated',
        message: isEmergency
          ? 'Urgent alert dispatched to Dr. Patel. If symptoms worsen, call 911.'
          : 'Report sent to clinical triage queue.'
      });

      eventBus.emit('danger_reported', { patientId, report: reportRes.data });
      if (onReportSubmitted) onReportSubmitted();
      onClose();
    } catch (err) {
      console.error('Error reporting danger sign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Report Red-Flag Danger Signs</h3>
              <p className="text-xs text-rose-300/80">Immediate clinical escalation & doctor notification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Emergency Callout Box */}
        {isEmergency && (
          <div className="bg-gradient-to-r from-rose-600 to-red-600 px-6 py-3 text-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
              <span>
                CRITICAL WARNING: If you experience crushing chest pain, difficulty speaking, or severe breathing distress, call 911 immediately.
              </span>
            </div>
            <a
              href="tel:911"
              className="px-3 py-1 bg-white text-rose-700 rounded-xl text-xs font-black shrink-0 hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call 911</span>
            </a>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Symptom Chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
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
                    className={`flex items-center justify-between p-3 rounded-2xl text-xs font-semibold border transition-all text-left ${
                      isSelected
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 shadow-md shadow-rose-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity & Vitals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Severity Rating */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Self-Assessed Severity</label>
              <select
                value={severityRating}
                onChange={(e) => setSeverityRating(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold"
              >
                <option value="mild">Mild (Noticeable but stable)</option>
                <option value="moderate">Moderate (Interferes with activity)</option>
                <option value="severe">Severe (Urgent clinician review needed)</option>
                <option value="critical">Critical / Emergency (Immediate)</option>
              </select>
            </div>

            {/* Vitals */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Current Blood Pressure & Pulse</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Sys"
                  value={systolicBP}
                  onChange={(e) => setSystolicBP(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-center text-rose-300 font-bold"
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={diastolicBP}
                  onChange={(e) => setDiastolicBP(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-center text-rose-300 font-bold"
                />
                <input
                  type="number"
                  placeholder="HR bpm"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-center text-sky-300 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Free Text Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Detailed Symptom Description</label>
            <textarea
              rows={2}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 leading-relaxed placeholder-slate-500"
              placeholder="Describe when symptoms started, location, and triggers..."
            />
          </div>

          {/* Photo Attachment Toggle */}
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-sky-400" />
              <div className="text-xs">
                <div className="font-bold text-slate-200">Attach Clinical Photo</div>
                <div className="text-slate-500 text-[11px]">
                  {hasPhoto ? 'Photo attached: ankle_edema_feet.jpg' : 'No photo attached'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHasPhoto(!hasPhoto)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                hasPhoto
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {hasPhoto ? 'Attached (ankle_edema.jpg)' : 'Attach Photo'}
            </button>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedTags.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Dispatching...' : 'Dispatch Alert to Doctor Patel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
