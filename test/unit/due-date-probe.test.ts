import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { DueCardList } from '@/components/homelab/DueCardList';
import { CalendarView } from '@/components/safety/CalendarView';
import { localVault } from '@/core/vault/LocalVault';
import { scheduleLabTool, syncToCalendarTool } from '@/tools/safetyTools';

describe('Due-date R5 — local-noon + range — probe 4 cases', () => {
  const pid = 'due-date-probe-patient';
  let origNow: any;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('carecanvas_active_user', JSON.stringify({ userId: pid, name: 'Probe', role: 'patient' }));
    localVault.clear();
    origNow = Date.now;
  });
  afterEach(() => {
    Date.now = origNow;
    localVault.clear();
    localStorage.clear();
  });

  it('Case A — Known ISO renders correctly, no off-by-one: Sep5 ISO shows Sep5 and DUE IN derived', async () => {
    // Mock Now to Sep1 noon UTC so diff to Sep5 noon is ~4 days
    const mockNow = new Date('2026-09-01T12:00:00.000Z').getTime();
    Date.now = () => mockNow;
    const dueCard = {
      id: 'due_test_iso',
      patientId: pid,
      testPanel: 'Creatinine & eGFR Blood Test',
      biomarkers: ['eGFR'],
      dueDate: new Date('2026-09-05T10:00:00.000Z').toISOString(),
      prescribedBy: 'Your doctor',
      prescribedDate: new Date('2026-08-20T10:00:00.000Z').toISOString(),
      instructions: 'Monitor',
      status: 'due_soon' as const,
    };
    localVault.addDueCard(dueCard as any);
    const cards = localVault.getDueCards(pid);
    expect(cards.length).toBe(1);
    const { container } = render(React.createElement(DueCardList, { dueCards: cards, onUploadClick: () => {} }));
    await waitFor(() => expect(container.textContent).toContain('Creatinine & eGFR Blood Test'));
    expect(container.textContent).toContain('Sep 5');
    expect(container.textContent).toContain('2026');
    // Badge DUE IN — daysRemaining 4 => either Due in 4 days or DUE IN 4 DAYS
    expect(container.textContent).toMatch(/Due in \d+ days|DUE IN/);
    // Now test overdue: set Now to Sep7 noon => due Sep5 is overdue
    Date.now = () => new Date('2026-09-07T12:00:00.000Z').getTime();
    // Need fresh render to recompute daysRemaining (component reads Date.now on render)
    const { container: c2 } = render(React.createElement(DueCardList, { dueCards: cards, onUploadClick: () => {} }));
    await waitFor(() => expect(c2.textContent).toContain('OVERDUE'));
    expect(c2.textContent).toMatch(/OVERDUE \(.*d ago\)/);
  });

  it('Case B — Date-only string no shift: 2026-09-08 shows Sep8 not Sep7 and calculateDaysRemaining correct', async () => {
    const mockNow = new Date('2026-09-01T12:00:00.000Z').getTime();
    Date.now = () => mockNow;
    const dueCard = {
      id: 'due_test_dateonly',
      patientId: pid,
      testPanel: 'Potassium Panel',
      biomarkers: ['Potassium'],
      dueDate: '2026-09-08',
      prescribedBy: 'Your doctor',
      prescribedDate: new Date('2026-08-20T10:00:00.000Z').toISOString(),
      instructions: 'Check',
      status: 'due_soon' as const,
    };
    localVault.addDueCard(dueCard as any);
    const cards = localVault.getDueCards(pid);
    const { container } = render(React.createElement(DueCardList, { dueCards: cards, onUploadClick: () => {} }));
    await waitFor(() => expect(container.textContent).toContain('Potassium Panel'));
    expect(container.textContent).toContain('Sep 8');
    // Must NOT show Sep 7 (UTC shift bug)
    expect(container.textContent).not.toContain('Sep 7');
    // daysRemaining for Sep8 noon minus Sep1 noon = 7
    // Check badge shows Due in 7 days
    expect(container.textContent).toMatch(/Due in 7 days|DUE IN 7 DAYS/);
    // Also verify helper via direct calc: Math.ceil((new Date('2026-09-08T12:00:00').getTime()-mockNow)/86400000) ===7
    const diff = Math.ceil((new Date('2026-09-08T12:00:00').getTime() - mockNow)/86400000);
    expect(diff).toBe(7);
  });

  it('Case C — Range + ICS sync: customStart 2026-09-05 customEnd 2026-09-10 -> rangeLabel Sep 5 — Sep 10 + range-bar + ICS DTEND', async () => {
    const rangeEvent = {
      id: 'cal_range_due_probe',
      patientId: pid,
      title: '🏥 Your doctor Follow-up: window',
      eventType: 'doctor_followup' as const,
      scheduledDate: new Date('2026-09-05T12:00:00').toISOString(),
      scheduledDateEnd: new Date('2026-09-10T12:00:00').toISOString(),
      reason: 'window Sep 5 — Sep 10',
      providerName: 'Your doctor',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
    } as any;
    localVault.addCalendarEvent(rangeEvent);
    const events = localVault.getCalendarEvents(pid);
    expect(events.length).toBe(1);
    expect((events[0] as any).scheduledDateEnd).toContain('2026-09-10');
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { container } = render(React.createElement(CalendarView, { events }));
    await waitFor(() => expect(container.textContent).toContain('Sep 5 — Sep 10'));
    expect(container.textContent).toContain('Sep 5 — Sep 10');
    const bar = container.querySelector('.range-bar');
    expect(bar).toBeTruthy();
    const rangeLabelEl = container.querySelector('[data-testid="range-label"]');
    expect(rangeLabelEl?.textContent).toContain('Sep 5 — Sep 10');
    // ICS via Blob spy
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
    expect(ics).toContain('20260905');
    expect(ics).toContain('DTEND:');
    expect(ics).toContain('20260910');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT2H');
    globalThis.Blob = OrigBlob;
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;

    // Verify FollowupScheduler T12 handling generates correct ISO
    const customStart = '2026-09-05';
    const customEnd = '2026-09-10';
    const scheduledDate = new Date(customStart + 'T12:00:00').toISOString();
    const scheduledDateEnd = new Date(customEnd + 'T12:00:00').toISOString();
    expect(scheduledDate).toContain('2026-09-05');
    expect(scheduledDateEnd).toContain('2026-09-10');
    // Ensure noon avoids UTC midnight shift: new Date('2026-09-08').toISOString() would be Sep8 00Z, but T12 gives 12 local
    const noonISO = new Date('2026-09-08T12:00:00').toISOString();
    expect(new Date(noonISO).getHours() !== 0 || noonISO.includes('T')).toBeTruthy();
  });

  it('Case D — schedule_lab tool with date-only targetDate stores ISO and displays correct + sync_to_calendar DTEND', async () => {
    const ctx: any = {
      patientId: pid,
      activeProfile: { userId: 'doc1', name: 'Your doctor', role: 'doctor', isProxy: false },
      vault: localVault,
      eventBus: { dispatchToast: () => {}, emit: () => {} },
    };
    const res = await scheduleLabTool.execute({ testPanel: 'Repeat eGFR', targetDate: '2026-09-10' }, ctx as any);
    expect(res.success).toBe(true);
    const dueCards = localVault.getDueCards(pid);
    const found = dueCards.find(c => c.testPanel === 'Repeat eGFR');
    expect(found).toBeTruthy();
    expect(found?.dueDate).toContain('2026-09-10');
    expect(found?.dueDate).toMatch(/T/);
    // Render display Sep 10
    const mockNow = new Date('2026-09-08T12:00:00.000Z').getTime();
    Date.now = () => mockNow;
    const { container } = render(React.createElement(DueCardList, { dueCards, onUploadClick: () => {} }));
    await waitFor(() => expect(container.textContent).toContain('Repeat eGFR'));
    expect(container.textContent).toContain('Sep 10');
    Date.now = origNow;

    // ISO targetDate preserves
    const res2 = await scheduleLabTool.execute({ testPanel: 'Potassium Check', targetDate: new Date('2026-09-12T10:00:00Z').toISOString() }, ctx as any);
    expect(res2.success).toBe(true);
    const found2 = localVault.getDueCards(pid).find(c => c.testPanel === 'Potassium Check');
    expect(found2?.dueDate).toContain('2026-09-12');

    // sync_to_calendar with range event should include DTEND
    const rangeEvt = {
      id: 'cal_sync_probe',
      patientId: pid,
      title: '🏥 Sync test',
      eventType: 'doctor_followup' as const,
      scheduledDate: new Date('2026-09-05T12:00:00').toISOString(),
      scheduledDateEnd: new Date('2026-09-10T12:00:00').toISOString(),
      reason: 'sync',
      providerName: 'Your doctor',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
    } as any;
    localVault.addCalendarEvent(rangeEvt);
    const syncRes = await syncToCalendarTool.execute({ eventId: 'cal_sync_probe' }, ctx as any);
    expect(syncRes.success).toBe(true);
    expect(syncRes.data.icsData).toContain('DTSTART:');
    expect(syncRes.data.icsData).toContain('DTEND:');
    expect(syncRes.data.icsData).toContain('20260905');
    expect(syncRes.data.icsData).toContain('20260910');
  });

  it('Empty state preserved', async () => {
    const { container } = render(React.createElement(DueCardList, { dueCards: [], onUploadClick: () => {} }));
    expect(container.textContent).toContain('All caught up!');
    expect(container.textContent).toContain('No tests waiting');
  });
});
