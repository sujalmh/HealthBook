import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CalendarView } from '@/components/safety/CalendarView';
import { FollowupScheduler } from '@/components/safety/FollowupScheduler';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

describe('Follow-up #6 — range 7-14 days — probe 3 cases', () => {
  const pid = 'followup-probe-patient';
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('healthbook_active_user', JSON.stringify({ userId: pid, name: 'Probe', role: 'patient' }));
    localVault.clear();
  });

  it('Case A — Single compat: addCalendarEvent old shape → CalendarView single dot In X days ICS DTSTART present DTEND absent', async () => {
    const singleId = 'cal_single_probe';
    localVault.addCalendarEvent({
      id: singleId,
      patientId: pid,
      title: '🏥 Your doctor Follow-up: check',
      eventType: 'doctor_followup',
      scheduledDate: '2026-09-03T10:00:00.000Z',
      reason: 'single compat check',
      providerName: 'Your doctor',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
    } as any);

    const events = localVault.getCalendarEvents(pid);
    expect(events.length).toBe(1);
    expect(events[0].scheduledDate).toBe('2026-09-03T10:00:00.000Z');
    expect((events[0] as any).scheduledDateEnd).toBeUndefined();

    // Render CalendarView at 375
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));
    const { container } = render(React.createElement(CalendarView, { events }));
    await waitFor(() => expect(container.textContent).toContain('Prescribed clinical calendar'));
    // Single dot label should contain ● single dot and NOT range bar
    expect(container.textContent).toContain('● single dot');
    expect(container.textContent).not.toContain('Aug 30 — Sep 5');
    // Should have In X days badge
    expect(container.textContent).toMatch(/In \d+ days|Past Milestone|Today/);
    // Filter chips keep working — click lab_due should show No scheduled events (since doctor_followup only)
    const labChip = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Prescribed Labs'));
    expect(labChip).toBeTruthy();
    if (labChip) fireEvent.click(labChip);
    await waitFor(() => expect(container.textContent).toContain('No scheduled events'));

    // ICS check: DTSTART present DTEND absent
    // Spy Blob
    const blobs: string[] = [];
    const OrigBlob = globalThis.Blob;
    // @ts-ignore mock
    globalThis.Blob = class MockBlob {
      content: string;
      constructor(parts: any[], opts: any) {
        this.content = parts.join('');
        blobs.push(this.content);
      }
    } as any;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const urls: string[] = [];
    // @ts-ignore
    URL.createObjectURL = (blob: any) => { urls.push('blob:mock'); return 'blob:mock'; };
    // @ts-ignore
    URL.revokeObjectURL = () => {};
    // Need to mock link click env: ensure document.body.appendChild works (jsdom)
    // Render again and trigger export
    const { container: c2 } = render(React.createElement(CalendarView, { events }));
    const exportBtn = Array.from(c2.querySelectorAll('button')).find(b => b.textContent?.includes('Export iCal'));
    expect(exportBtn).toBeTruthy();
    if (exportBtn) fireEvent.click(exportBtn);
    await new Promise(r => setTimeout(r, 50));
    expect(blobs.length).toBeGreaterThan(0);
    const ics = blobs[blobs.length - 1];
    expect(ics).toContain('DTSTART:');
    expect(ics).toContain('20260903');
    // DTEND should be absent for single
    // Our implementation omits DTEND when scheduledDateEnd undefined
    const hasDTEND = ics.includes('DTEND:');
    expect(hasDTEND).toBe(false);
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT2H');
    // Restore
    globalThis.Blob = OrigBlob;
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it('Case B — Range creation: FollowupScheduler toggle Is this a range? set Earliest 2026-08-30 Latest 2026-09-05 submit → vault scheduledDateEnd', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    let toastMsg = '';
    const origDispatch = eventBus.dispatchToast as any;
    const toastSpy = vi.fn((t: any) => { toastMsg = t.title || t.message || JSON.stringify(t); });
    // spy
    const spy = vi.spyOn(eventBus, 'dispatchToast').mockImplementation(toastSpy as any);

    const onScheduled = vi.fn();
    const onClose = vi.fn();
    const { baseElement } = render(React.createElement(FollowupScheduler, { isOpen: true, onClose, patientId: pid, onScheduled }));
    await waitFor(() => expect(baseElement.textContent).toContain('When? (pick a date or a date range)'));
    expect(baseElement.textContent).toContain('Is this a range?');
    const checkbox = baseElement.querySelector('input[type=\"checkbox\"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    // Initially single mode should show Target Timing buttons; after toggle should show Earliest/Latest
    expect(baseElement.textContent).toContain('In 3 Days');
    fireEvent.click(checkbox);
    await waitFor(() => expect(baseElement.textContent).toContain('Earliest:'));
    expect(baseElement.textContent).toContain('Latest:');
    expect(baseElement.textContent).toContain('Your clinic can see you anytime in this window');
    // Find Earliest and Latest inputs
    const earliestInput = baseElement.querySelector('input[aria-label=\"Earliest date\"]') as HTMLInputElement;
    const latestInput = baseElement.querySelector('input[aria-label=\"Latest date\"]') as HTMLInputElement;
    expect(earliestInput).toBeTruthy();
    expect(latestInput).toBeTruthy();
    // Set dates
    fireEvent.change(earliestInput, { target: { value: '2026-08-30' } });
    fireEvent.change(latestInput, { target: { value: '2026-09-05' } });
    await waitFor(() => expect((earliestInput as any).value).toBe('2026-08-30'));
    // Submit via Book & Synchronize Calendar button
    const submitBtn = Array.from(baseElement.querySelectorAll('button')).find(b => b.textContent?.includes('Book & Synchronize Calendar'));
    expect(submitBtn).toBeTruthy();
    if (submitBtn) fireEvent.click(submitBtn);
    await waitFor(() => {
      const hasClose = onClose.mock.calls.length > 0;
      const hasToast = toastSpy.mock.calls.length > 0;
      expect(hasClose || hasToast).toBe(true);
    }, { timeout: 2000 });
    // Check vault
    const events = localVault.getCalendarEvents(pid);
    expect(events.length).toBe(1);
    const ev = events[0] as any;
    expect(ev.scheduledDate).toContain('2026-08-30');
    expect(ev.scheduledDateEnd).toContain('2026-09-05');
    // Toast
    expect(toastSpy).toHaveBeenCalled();
    expect(toastMsg).toContain('Follow-up Scheduled');
    spy.mockRestore();
  });

  it('Case C — Calendar bar + ICS range: render CalendarView at 375 → Aug 30 — Sep 5 label bar not dot; Blob spy contains DTSTART 20260830 and DTEND 20260905 + VALARM x2', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));
    const rangeEvent = {
      id: 'cal_range_probe',
      patientId: pid,
      title: '🏥 Your doctor Follow-up: window test',
      eventType: 'doctor_followup' as const,
      scheduledDate: '2026-08-30T10:00:00.000Z',
      scheduledDateEnd: '2026-09-05T10:00:00.000Z',
      reason: 'window Aug 30 — Sep 5',
      providerName: 'Your doctor',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
    } as any;
    localVault.addCalendarEvent(rangeEvent);
    const events = localVault.getCalendarEvents(pid);
    const { container } = render(React.createElement(CalendarView, { events }));
    await waitFor(() => expect(container.textContent).toContain('Prescribed clinical calendar'));
    // Should show range label Aug 30 — Sep 5 (en-US month short)
    expect(container.textContent).toContain('Aug 30 — Sep 5');
    // Bar not dot: should have range-bar element and NOT ● single dot for this range event? But our component renders range bar for range and dot for single; since only range event, should have bar and not dot? Actually for range it shows bar, for single it shows dot. So check bar present
    const bar = container.querySelector('.range-bar');
    expect(bar).toBeTruthy();
    // For range event, single dot should NOT be in that event's card? But single dot is inside ternary else; for range we don't render dot. So check dot count 0 when only range?
    // However our previous single test had dot. Here with only range, dot should be 0
    const dots = Array.from(container.querySelectorAll('*')).filter(el => el.textContent?.includes('● single dot'));
    expect(dots.length).toBe(0);
    // Also filter chips still work: All Scheduled Events should show 1, lab filter should show 0
    const allChip = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('All Scheduled Events'));
    expect(allChip).toBeTruthy();
    if (allChip) fireEvent.click(allChip);
    await waitFor(() => expect(container.textContent).toContain('Aug 30 — Sep 5'));
    // ICS check via Blob spy
    const blobs: string[] = [];
    const OrigBlob = globalThis.Blob;
    // @ts-ignore mock
    globalThis.Blob = class MockBlob {
      content: string;
      constructor(parts: any[], opts: any) {
        this.content = parts.join('');
        blobs.push(this.content);
      }
    } as any;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    // @ts-ignore
    URL.createObjectURL = (blob: any) => 'blob:mock';
    // @ts-ignore
    URL.revokeObjectURL = () => {};
    const { container: c2 } = render(React.createElement(CalendarView, { events }));
    const exportBtn = Array.from(c2.querySelectorAll('button')).find(b => b.textContent?.includes('Export iCal'));
    expect(exportBtn).toBeTruthy();
    if (exportBtn) fireEvent.click(exportBtn);
    await new Promise(r => setTimeout(r, 30));
    expect(blobs.length).toBeGreaterThan(0);
    const ics = blobs[blobs.length - 1];
    expect(ics).toContain('DTSTART:');
    expect(ics).toContain('20260830');
    expect(ics).toContain('DTEND:');
    expect(ics).toContain('20260905');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT2H');
    // VALARM x2 counts
    const valarmCount = (ics.match(/BEGIN:VALARM/g) || []).length;
    expect(valarmCount).toBe(2);
    // Restore
    globalThis.Blob = OrigBlob;
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });
});

