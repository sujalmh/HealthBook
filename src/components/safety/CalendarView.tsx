import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Stethoscope,
  Activity,
  Pill,
  ExternalLink,
  Plus,
  Filter
} from 'lucide-react';
import type { CalendarEventRecord } from '@/types/vault';
import { eventBus } from '@/core/events/eventBus';

interface CalendarViewProps {
  events: CalendarEventRecord[];
  onAddEventClick?: () => void;
  onUploadSlipClick?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onAddEventClick,
  onUploadSlipClick
}) => {
  const [filterType, setFilterType] = useState<'all' | 'doctor_followup' | 'lab_due' | 'med_reminder'>('all');

  const filteredEvents = events.filter((e) => filterType === 'all' || e.eventType === filterType);

  const generateAndDownloadICS = () => {
    let icsString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CareCanvas Health Companion//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].join('\r\n');

    for (const evt of events) {
      const dt = new Date(evt.scheduledDate);
      const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtstart = dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      icsString += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:carecanvas-event-${evt.id}@carecanvas.app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `SUMMARY:${evt.title}`,
        `DESCRIPTION:${evt.reason || 'CareCanvas Prescribed Milestone'}`,
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder: 24 hours prior to CareCanvas appointment',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT2H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder: 2 hours prior to CareCanvas appointment',
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');
    }

    icsString += '\r\nEND:VCALENDAR';

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `carecanvas_prescribed_schedule_${new Date().toISOString().split('T')[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    eventBus.dispatchToast({
      type: 'success',
      title: 'iCal Exported (.ics)',
      message: 'Prescribed events downloaded. Import into Apple, Google, or Outlook calendar.'
    });
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header & Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shadow-inner">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Prescribed Clinical Calendar</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-700 font-bold border border-sky-200">
                24h & 2h Active Alerts
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Synchronized follow-up visits, lab due cadences, and medication reminder windows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={generateAndDownloadICS}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Export iCal (.ics)</span>
          </button>

          {onAddEventClick && (
            <button
              onClick={onAddEventClick}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Book Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Scheduled Events' },
          { id: 'doctor_followup', label: '🏥 Doctor Follow-Ups' },
          { id: 'lab_due', label: '🧪 Prescribed Labs' },
          { id: 'med_reminder', label: '💊 Daily Reminders' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap border ${
              filterType === tab.id
                ? 'bg-sky-500/20 border-sky-500 text-sky-700'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events Stream */}
      {filteredEvents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-600">No scheduled events in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((evt) => {
            const dt = new Date(evt.scheduledDate);
            const isPast = dt.getTime() < Date.now();
            const daysAway = Math.ceil((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={evt.id}
                className="bg-white border border-slate-200 hover:border-slate-200 rounded-2xl p-4 transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                      evt.eventType === 'doctor_followup'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-200'
                        : evt.eventType === 'lab_due'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-200'
                    }`}
                  >
                    {evt.eventType === 'doctor_followup' ? (
                      <Stethoscope className="w-5 h-5" />
                    ) : evt.eventType === 'lab_due' ? (
                      <Activity className="w-5 h-5" />
                    ) : (
                      <Pill className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{evt.title}</h4>
                      {isPast ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          Past Milestone
                        </span>
                      ) : daysAway <= 3 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-bold border border-amber-200 animate-pulse">
                          In {daysAway === 0 ? 'Today' : `${daysAway} days`}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 text-[10px] font-semibold border border-sky-500/20">
                          In {daysAway} days
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600">{evt.reason}</p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Bell className="w-3 h-3 text-amber-400" />
                        24h & 2h alerts active
                      </span>
                      {evt.providerName && <span>• Provider: {evt.providerName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-800">
                      {dt.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      {dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {evt.eventType === 'lab_due' && onUploadSlipClick && (
                    <button
                      onClick={onUploadSlipClick}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Upload Slip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
