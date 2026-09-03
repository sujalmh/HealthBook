import React, { useState } from 'react';
import {
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
  Filter,
  Upload
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

  const parseCalendarDate = (s: string): Date => /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s);
  const generateAndDownloadICS = () => {
    let icsString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Healthbook Health Companion//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].join('\r\n');

    for (const evt of events) {
      const dt = parseCalendarDate(evt.scheduledDate);
      const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtstart = dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtendRaw = (evt as unknown as { scheduledDateEnd?: string }).scheduledDateEnd as string | undefined;
      const dtend = dtendRaw ? parseCalendarDate(dtendRaw).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : null;

      const veventLines = [
        'BEGIN:VEVENT',
        `UID:healthbook-event-${evt.id}@healthbook.app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        ...(dtend ? [`DTEND:${dtend}`] : []),
        `SUMMARY:${evt.title}`,
        `DESCRIPTION:${evt.reason || 'Healthbook Prescribed Milestone'}`,
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder: 24 hours prior to Healthbook appointment',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT2H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder: 2 hours prior to Healthbook appointment',
        'END:VALARM',
        'END:VEVENT'
      ];

      icsString += '\r\n' + veventLines.join('\r\n');
    }

    icsString += '\r\nEND:VCALENDAR';

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `healthbook_prescribed_schedule_${new Date().toISOString().split('T')[0]}.ics`);
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
    <div className="space-y-3">
      {/* Calendar Header & Actions — tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
        <div>
          <h3 className="text-heading-md text-slate-900">Appointments</h3>
          <p className="text-caption text-muted">Prescribed clinical calendar</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={generateAndDownloadICS}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>Export iCal</span>
          </button>

          {onAddEventClick && (
            <button
              onClick={onAddEventClick}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          )}

          {onUploadSlipClick && (
            <button
              onClick={onUploadSlipClick}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-slate-700 text-xs font-bold transition-all min-h-[44px]"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Slip</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Scheduled Events' },
          { id: 'doctor_followup', label: 'Visits' },
          { id: 'lab_due', label: 'Prescribed Labs' },
          { id: 'med_reminder', label: 'Reminders' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id as unknown as typeof filterType)}
              className={`px-3.5 py-1.5 rounded-xl text-body-sm font-semibold transition-colors whitespace-nowrap border ${
              filterType === tab.id
                ? 'bg-sky-50 border-sky-200 text-clinical-blue'
                : 'bg-canvas-card border-canvas-border text-muted hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events Stream */}
      {filteredEvents.length === 0 ? (
        <p className="text-body-sm text-muted">No scheduled events in this category.</p>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((evt) => {
            const dt = parseCalendarDate(evt.scheduledDate);
            const isRangeEvent = !!(evt as unknown as { scheduledDateEnd?: string }).scheduledDateEnd;
            const dtEnd = isRangeEvent ? parseCalendarDate((evt as unknown as { scheduledDateEnd?: string }).scheduledDateEnd as string) : null;
            const isPast = dt.getTime() < Date.now();
            const daysAway = Math.ceil((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const rangeLabel = isRangeEvent && dtEnd
              ? `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${dtEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : null;

            return (
              <div
                key={evt.id}
                className="bg-canvas-card border border-canvas-border hover:border-primary-border rounded-xl p-4 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      evt.eventType === 'doctor_followup'
                        ? 'bg-sky-50 text-clinical-blue border-sky-200'
                        : evt.eventType === 'lab_due'
                        ? 'bg-rose-50 text-clinical-red border-rose-200'
                        : 'bg-amber-50 text-clinical-amber border-amber-200'
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
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-bold border border-amber-200">
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
                    {isRangeEvent && rangeLabel && dtEnd ? (
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-800" data-testid="range-label">{rangeLabel}</div>
                        <div className="h-1.5 w-28 bg-sky-500 rounded-full range-bar" aria-label={`range bar ${rangeLabel}`} />
                        <div className="text-[11px] text-slate-600 font-mono">
                          {dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} window
                        </div>
                      </div>
                    ) : (
                      <>
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
                        <div className="text-[9px] text-slate-400" aria-hidden>● single dot</div>
                      </>
                    )}
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
