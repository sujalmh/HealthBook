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
  const [providerName, setProviderName] = useState('Dr. Anita Patel, MD (Nephrology / Cardiology)');
  const [reason, setReason] = useState('Urgent follow-up evaluation for peripheral edema & blood pressure control');
  const [clinicAddress, setClinicAddress] = useState('City Health Nephrology Clinic, Suite 402, 100 Medical Plaza');
  const [telehealthLink, setTelehealthLink] = useState('https://carecanvas.telehealth.live/dr-patel/room-901');
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
          providerName
        },
        {
          patientId,
          activeProfile: { userId: 'dr_patel_md', name: providerName, role: 'doctor', isProxy: false },
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
            recipients: ['patient', 'caregiver_raj']
          },
          {
            patientId,
            activeProfile: { userId: 'dr_patel_md', name: providerName, role: 'doctor', isProxy: false },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Order Direct Clinical Follow-Up</h3>
              <p className="text-xs text-slate-600">Prescribe urgent in-person or telehealth review</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-600 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Appointment Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Appointment Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAppointmentType('in_person_clinic')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  appointmentType === 'in_person_clinic'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-700 shadow-md shadow-sky-500/10'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                <span>In-Person Clinic Visit</span>
              </button>

              <button
                type="button"
                onClick={() => setAppointmentType('telehealth_video')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  appointmentType === 'telehealth_video'
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200'
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
            <div className="grid grid-cols-4 gap-2">
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
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                    dateOffset === opt.id
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200'
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
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
            />
          </div>

          {/* Notification Reminders Callout */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Automated Reminders: 24h & 2h before appointment
            </span>
            <span className="text-emerald-400 font-mono text-[11px]">Synced to iCal & Google</span>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-sky-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isSubmitting ? 'Booking...' : 'Book & Synchronize Calendar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
