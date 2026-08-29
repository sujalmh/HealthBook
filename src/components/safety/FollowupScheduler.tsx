import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  Bell,
  PlusCircle,
  User,
  Share2,
  X
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface FollowupSchedulerProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  onScheduled?: () => void;
}

export const FollowupScheduler: React.FC<FollowupSchedulerProps> = ({
  isOpen,
  onClose,
  patientId,
  onScheduled
}) => {
  const [appointmentType, setAppointmentType] = useState<'in_person_clinic' | 'telehealth_video'>('in_person_clinic');
  const [dateOffset, setDateOffset] = useState<string>('+3d');
  const [customDate, setCustomDate] = useState<string>(
    new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  );
  const [providerName, setProviderName] = useState('Your doctor');
  const [reason, setReason] = useState('Urgent follow-up evaluation for peripheral edema & blood pressure control');
  const [clinicAddress, setClinicAddress] = useState('Clinic, Suite 402, 100 Medical Plaza');
  const [telehealthLink, setTelehealthLink] = useState('https://carecanvas.telehealth.live/clinic/room-901');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const scheduledDate = dateOffset === 'custom' ? new Date(customDate).toISOString() : dateOffset;

      // 1. Schedule follow up tool
      const schedRes = await webMCPEngine.execute(
        'schedule_followup',
        {
          date: scheduledDate,
          appointmentType,
          reason,
          providerName: (providerName || '').trim() || 'Your doctor'
        },
        {
          patientId,
          activeProfile: { userId: 'clinician', name: (providerName || '').trim() || 'Your doctor', role: 'doctor', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      // 2. Sync to calendar
      if (schedRes.success && schedRes.data) {
        await webMCPEngine.execute(
          'sync_to_calendar',
          {
            eventId: schedRes.data.id,
            recipients: ['patient', 'caregiver_family']
          },
          {
            patientId,
            activeProfile: { userId: 'clinician', name: (providerName || '').trim() || 'Your doctor', role: 'doctor', isProxy: false },
            vault: localVault,
            eventBus
          }
        );
      }

      eventBus.dispatchToast({
        type: 'success',
        title: 'Follow-up Scheduled',
        message: `Appointment booked with ${providerName}. 24h & 2h reminders active.`
      });

      eventBus.emit('calendar_event_added', schedRes.data);
      if (onScheduled) onScheduled();
      onClose();
    } catch (err) {
      console.error('Error scheduling follow-up:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-xl w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-canvas-border bg-canvas-card gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-clinical-blue flex items-center justify-center border border-sky-200 shadow-sm shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-heading-md text-slate-900 truncate">Order direct clinical follow-up</h3>
              <p className="text-body-sm text-muted line-clamp-1">Prescribe urgent in-person or telehealth review</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted hover:text-slate-900 flex items-center justify-center transition-colors shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Close follow-up scheduler"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Appointment Type */}
          <div className="space-y-1.5">
            <label className="text-body-sm font-semibold text-slate-700">Appointment mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAppointmentType('in_person_clinic')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-body-sm font-bold transition-all min-h-[44px] ${
                  appointmentType === 'in_person_clinic'
                    ? 'bg-sky-50 border-sky-200 text-clinical-blue shadow-sm'
                    : 'bg-canvas-muted border-canvas-border text-muted hover:text-slate-900'
                }`}
              >
                <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                <span>In-Person Clinic Visit</span>
              </button>

              <button
                type="button"
                onClick={() => setAppointmentType('telehealth_video')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-body-sm font-bold transition-all min-h-[44px] ${
                  appointmentType === 'telehealth_video'
                    ? 'bg-primary-light border-primary-border text-primary-text shadow-sm'
                    : 'bg-canvas-muted border-canvas-border text-muted hover:text-slate-900'
                }`}
              >
                <Video className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Telehealth Video Call</span>
              </button>
            </div>
          </div>

          {/* Timing / Offset */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Target Timing</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '+3d', label: 'In 3 Days' },
                { id: '+1w', label: 'In 1 Week' },
                { id: '+2w', label: 'In 2 Weeks' },
                { id: 'custom', label: 'Custom Date' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDateOffset(opt.id)}
                  className={`py-2.5 px-2 rounded-xl text-body-sm font-bold border transition-colors min-h-[40px] ${
                    dateOffset === opt.id
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-canvas-muted border-canvas-border text-muted hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {dateOffset === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 min-h-[44px]"
              />
            )}
          </div>

          {/* Provider Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Attending Clinician / Specialty</label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold min-h-[44px]"
            />
          </div>

          {/* Clinical Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Clinical Purpose & Evaluation Goal</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed"
            />
          </div>

          {/* Location / Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {appointmentType === 'in_person_clinic' ? 'Clinic Address' : 'Telehealth Link'}
            </label>
            <input
              type="text"
              value={appointmentType === 'in_person_clinic' ? clinicAddress : telehealthLink}
              onChange={(e) =>
                appointmentType === 'in_person_clinic'
                  ? setClinicAddress(e.target.value)
                  : setTelehealthLink(e.target.value)
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 min-h-[44px]"
            />
          </div>

          {/* Notification Reminders Callout */}
          <div className="bg-canvas-muted rounded-xl p-3 border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-body-sm text-muted">
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-clinical-amber shrink-0" />
              Automated reminders: 24h & 2h before
            </span>
            <span className="text-clinical-emerald font-mono text-caption">Synced to iCal & Google</span>
          </div>
        </form>

        {/* Footer */}
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
            disabled={isSubmitting || !reason.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-sky-600/20 min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isSubmitting ? 'Booking...' : 'Book & Synchronize Calendar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
