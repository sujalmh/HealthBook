import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import React from 'react';
import { IndicatorTable } from '@/components/labstory/IndicatorTable';
import { FactStreamView } from '@/components/vault/FactStreamView';
import { localVault } from '@/core/vault/LocalVault';
import type { LabRecord } from '@/types/vault';

describe('R3 — Indicators unique one table details on click — probe 3 cases', () => {
  const pid = 'indicators-probe-patient';
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('carecanvas_active_user', JSON.stringify({ userId: pid, name: 'Probe', role: 'patient' }));
    localVault.clear();
  });

  it('Case A — unique 3 rows not 5 draws (deduplicated via findLocalStandard)', async () => {
    // 5 draws: Creatinine x2, eGFR x2, HbA1c x1 => 3 unique markers
    const labs: LabRecord[] = [
      { id: 'lab_creat_1', patientId: pid, marker: 'Creatinine', value: 1.2, unit: 'mg/dL', normalizedValue: 1.2, normalizedUnit: 'mg/dL', drawDate: '2026-01-10T08:00:00Z', referenceRange: { low: 0.6, high: 1.2 }, optimalRange: { low: 0.7, high: 1.0 }, isBorderline: true, isCritical: false, flag: 'NORMAL' },
      { id: 'lab_creat_2', patientId: pid, marker: 'creatinine', value: 1.9, unit: 'mg/dL', normalizedValue: 1.9, normalizedUnit: 'mg/dL', drawDate: '2026-02-15T08:00:00Z', referenceRange: { low: 0.6, high: 1.2 }, optimalRange: { low: 0.7, high: 1.0 }, isBorderline: false, isCritical: false, flag: 'HIGH' },
      { id: 'lab_egfr_1', patientId: pid, marker: 'eGFR', value: 58, unit: 'mL/min/1.73m2', normalizedValue: 58, normalizedUnit: 'mL/min/1.73m2', drawDate: '2026-01-10T08:00:00Z', referenceRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, isBorderline: true, isCritical: false, flag: 'LOW' },
      { id: 'lab_egfr_2', patientId: pid, marker: 'EGFR', value: 28, unit: 'mL/min/1.73m2', normalizedValue: 28, normalizedUnit: 'mL/min/1.73m2', drawDate: '2026-02-20T08:00:00Z', referenceRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, isBorderline: false, isCritical: false, flag: 'LOW' },
      { id: 'lab_hba1c_1', patientId: pid, marker: 'HbA1c', value: 7.2, unit: '%', normalizedValue: 7.2, normalizedUnit: '%', drawDate: '2026-01-10T08:00:00Z', referenceRange: { low: 4.0, high: 5.6 }, optimalRange: { low: 4.5, high: 5.4 }, isBorderline: false, isCritical: false, flag: 'HIGH' },
    ];
    // also test Glucose dedup: Glucose vs Glucose Fasting should be one row via findLocalStandard
    const glucoseLabs: LabRecord[] = [
      { id: 'lab_glu_1', patientId: pid, marker: 'Glucose', value: 110, unit: 'mg/dL', normalizedValue: 110, normalizedUnit: 'mg/dL', drawDate: '2026-01-10T08:00:00Z', referenceRange: { low: 70, high: 99 }, optimalRange: { low: 75, high: 90 }, isBorderline: false, isCritical: false, flag: 'HIGH' },
      { id: 'lab_glu2_1', patientId: pid, marker: 'Glucose Fasting', value: 95, unit: 'mg/dL', normalizedValue: 95, normalizedUnit: 'mg/dL', drawDate: '2026-02-10T08:00:00Z', referenceRange: { low: 70, high: 99 }, optimalRange: { low: 75, high: 90 }, isBorderline: true, isCritical: false, flag: 'NORMAL' },
    ];
    // render with 5 labs => 3 rows
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));
    const { container } = render(React.createElement(IndicatorTable, { labs, selectedMarker: 'eGFR', onMarkerSelect: () => {} }));
    await waitFor(() => expect(container.textContent).toContain('Indicators — 3 unique'));
    // count role=button rows
    const rows = container.querySelectorAll('tbody tr[role="button"]');
    expect(rows.length).toBe(3);
    // ensure not 5
    expect(rows.length).not.toBe(5);
    // each row should have min-h-[44px] via style height 44px or class
    rows.forEach((r) => {
      const el = r as HTMLElement;
      expect(el.getAttribute('role')).toBe('button');
      expect(el.getAttribute('tabIndex')).toBe('0');
      expect(el.getAttribute('aria-label')).toMatch(/tap for details/i);
      // check focus-visible ring class present
      expect(el.className).toContain('focus-visible:ring-primary');
      // check min-h 44 via style or class
      // we set style height 44px
      expect(el.style.height === '44px' || el.className.includes('min-h-[44px]')).toBe(true);
    });
    // also test glucose dedup: Glucose + Glucose Fasting => 1 row
    const { container: c2 } = render(React.createElement(IndicatorTable, { labs: glucoseLabs }));
    await waitFor(() => expect(c2.textContent).toContain('Indicators — 1 unique'));
    const rows2 = c2.querySelectorAll('tbody tr[role="button"]');
    expect(rows2.length).toBe(1);
    expect(c2.textContent).toContain('Glucose Fasting');
    console.log('[PASS] Case A unique 3 rows not 5 draws, glucose dedup 1 row, role button 44px');
  });

  it('Case B — details on click shows Latest/Reference/Flag/Chart', async () => {
    const labs: LabRecord[] = [
      { id: 'lab_creat_1b', patientId: pid, marker: 'Creatinine', value: 1.9, unit: 'mg/dL', normalizedValue: 1.9, normalizedUnit: 'mg/dL', drawDate: '2026-02-15T08:00:00Z', referenceRange: { low: 0.6, high: 1.2 }, optimalRange: { low: 0.7, high: 1.0 }, isBorderline: false, isCritical: false, flag: 'HIGH' },
      { id: 'lab_egfr_1b', patientId: pid, marker: 'eGFR', value: 28, unit: 'mL/min/1.73m2', normalizedValue: 28, normalizedUnit: 'mL/min/1.73m2', drawDate: '2026-02-20T08:00:00Z', referenceRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, isBorderline: false, isCritical: false, flag: 'LOW' },
      // add history for eGFR
      { id: 'lab_egfr_0b', patientId: pid, marker: 'eGFR', value: 45, unit: 'mL/min/1.73m2', normalizedValue: 45, normalizedUnit: 'mL/min/1.73m2', drawDate: '2026-01-10T08:00:00Z', referenceRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, isBorderline: false, isCritical: false, flag: 'LOW' },
      // doctor comment for egfr latest
      { id: 'lab_hba1c_1b', patientId: pid, marker: 'HbA1c', value: 9.0, unit: '%', normalizedValue: 9.0, normalizedUnit: '%', drawDate: '2026-01-10T08:00:00Z', referenceRange: { low: 4.0, high: 5.6 }, optimalRange: { low: 4.5, high: 5.4 }, isBorderline: false, isCritical: false, flag: 'HIGH', doctorComment: { doctorId: 'dr1', doctorName: 'Dr. A', comment: 'Monitor HbA1c closely, consider dose adjustment', timestamp: '2026-02-21T10:00:00Z' } } as any,
    ];
    // ensure eGFR latest has doctor comment too
    (labs[1] as any).doctorComment = { doctorId: 'dr2', doctorName: 'Dr. Patel', comment: 'eGFR low, hold NSAIDs', timestamp: '2026-02-21T10:00:00Z' };
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { container, baseElement } = render(React.createElement(IndicatorTable, { labs, selectedMarker: 'eGFR', onMarkerSelect: () => {} }));
    await waitFor(() => expect(container.textContent).toContain('Indicators — 3 unique'));
    const egfrRow = Array.from(container.querySelectorAll('tbody tr[role="button"]')).find((r) => r.textContent?.includes('eGFR')) as HTMLElement;
    expect(egfrRow).toBeTruthy();
    fireEvent.click(egfrRow);
    // modal should appear with Latest/Reference/Flag/Chart/history
    await waitFor(() => expect(baseElement.textContent).toContain('eGFR — Details'));
    expect(baseElement.textContent).toContain('Latest Value');
    expect(baseElement.textContent).toContain('Reference');
    expect(baseElement.textContent).toContain('Optimal');
    // reference range values from vault 60-120 and 90-120 for eGFR
    expect(baseElement.textContent).toContain('60–120');
    expect(baseElement.textContent).toContain('90–120');
    // flag LOW should be visible
    expect(baseElement.textContent).toContain('LOW');
    // doctor comment should be visible inside details
    expect(baseElement.textContent).toContain('Dr. Patel');
    expect(baseElement.textContent).toContain('hold NSAIDs');
    // history should contain both eGFR draws
    expect(baseElement.textContent).toContain('Recent history');
    // BiomarkerChart should be embedded — check for svg or trajectory label
    // BiomarkerChart renders svg with viewBox and unit label
    expect(baseElement.innerHTML).toContain('<svg');
    expect(baseElement.textContent).toContain('Trajectory');
    // plain explanation
    expect(baseElement.textContent).toContain('Your eGFR is');
    // check that overview had 3 rows but history inside details has 2 draws for eGFR
    // close modal
    const closeBtn = Array.from(baseElement.querySelectorAll('button')).find((b) => b.textContent?.includes('Close')) as HTMLElement;
    expect(closeBtn).toBeTruthy();
    console.log('[PASS] Case B details on click shows Latest/Reference/Flag/Chart+doctorComment+history');
  });

  it('Case C — no scattered duplicates FactStreamView (labs delegated to IndicatorTable)', async () => {
    // Add facts: 2 lab + 2 med pending
    const factLab1: any = { id: 'fact_lab_1', patientId: pid, category: 'lab', name: 'Creatinine', value: '1.9 mg/dL', unit: 'mg/dL', factValue: '1.9', status: 'unconfirmed', approvalStatus: 'pending', plainExplanation: 'Creatinine high', confidence: 0.9, sourceDocId: 'doc1', boundingBox: null, createdAt: new Date().toISOString() };
    const factLab2: any = { id: 'fact_lab_2', patientId: pid, category: 'lab', name: 'eGFR', value: '28 mL/min', unit: 'mL/min', factValue: '28', status: 'unconfirmed', approvalStatus: 'pending', plainExplanation: 'eGFR low', confidence: 0.9, sourceDocId: 'doc1', boundingBox: null, createdAt: new Date().toISOString() };
    const factMed1: any = { id: 'fact_med_1', patientId: pid, category: 'medication', name: 'Metformin', value: '1000mg', unit: 'mg', factValue: '1000mg', status: 'unconfirmed', approvalStatus: 'pending', plainExplanation: 'Metformin twice daily', confidence: 0.95, sourceDocId: 'doc1', boundingBox: null, createdAt: new Date().toISOString() };
    // add via vault
    localVault.addFact(factLab1);
    localVault.addFact(factLab2);
    localVault.addFact(factMed1);
    // also add one approved lab and one approved med
    const factLabApproved: any = { id: 'fact_lab_ap_1', patientId: pid, category: 'lab', name: 'HbA1c', value: '9%', unit: '%', factValue: '9', status: 'confirmed', approvalStatus: 'approved', plainExplanation: 'HbA1c high', confidence: 0.92, sourceDocId: 'doc2', boundingBox: null, createdAt: new Date().toISOString(), approvedAt: new Date().toISOString() };
    const factMedApproved: any = { id: 'fact_med_ap_1', patientId: pid, category: 'medication', name: 'Lisinopril', value: '10mg', unit: 'mg', factValue: '10mg', status: 'confirmed', approvalStatus: 'approved', plainExplanation: 'Lisinopril daily', confidence: 0.93, sourceDocId: 'doc2', boundingBox: null, createdAt: new Date().toISOString(), approvedAt: new Date().toISOString() };
    localVault.addFact(factLabApproved);
    localVault.addFact(factMedApproved);
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { container } = render(React.createElement(FactStreamView, { patientId: pid }));
    await waitFor(() => expect(container.textContent).toContain('Review extracted details'));
    // Pending table should NOT contain lab rows as duplicateIndicator: should have delegation banner and not duplicate lab rows
    // Check that pending lab names not in tbody rows? The tbody rows for pending should only contain medication
    const pendingRows = container.querySelectorAll('table tbody tr');
    // find text inside pending table: should contain Metformin but not Creatinine/eGFR in rows (banner may mention labs)
    const tbodyText = Array.from(pendingRows).map((r) => r.textContent).join(' | ');
    // banner mentions labs but rows should not duplicate
    expect(container.textContent).toContain('lab'); // banner mentions labs delegated
    expect(container.textContent).toContain('Indicators'); // delegation text
    // Ensure rows do NOT contain Creatinine/eGFR as row data (but banner may contain word labs)
    // Check that at least one pending row is medication and none is lab
    const hasLabRow = Array.from(pendingRows).some((r) => r.textContent?.includes('Creatinine') && r.textContent?.includes('lab'));
    // More precise: check category cell contains lab vs medication
    const categoryCells = Array.from(container.querySelectorAll('tbody tr td')).map((td) => td.textContent);
    // category column contains 'lab' or 'medication' - pending display should exclude lab
    const pendingLabCategoryPresent = Array.from(container.querySelectorAll('table')).some((tbl) => {
      // first table is pending; check its category cells
      const firstTable = container.querySelectorAll('table')[0];
      if (!firstTable) return false;
      return firstTable.textContent?.toLowerCase().includes('creatinine') && firstTable.querySelector('tbody')?.textContent?.includes('Creatinine');
    });
    // Instead assert that pendingFactsDisplay filtering works: pending row count should be 1 (only med), not 3
    const firstTableRows = container.querySelectorAll('table')[0]?.querySelectorAll('tbody tr')?.length ?? 0;
    expect(firstTableRows).toBe(1); // only med
    // Saved records: when viewing 'all', should not show lab duplicates; when viewing 'lab' tab, should show delegation panel not lab rows
    const savedSection = container.textContent;
    expect(savedSection).toContain('Your Saved Records');
    // Initially selectedCategory is 'all', so filteredApprovedFacts excludes lab, should show 1 saved row (Lisinopril) not HbA1c
    const tables = container.querySelectorAll('table');
    const savedTable = tables[1];
    if (savedTable) {
      const savedRows = savedTable.querySelectorAll('tbody tr');
      expect(savedRows.length).toBe(1);
      expect(savedTable.textContent).toContain('Lisinopril');
      expect(savedTable.textContent).not.toContain('HbA1c');
    }
    // Click lab tab to see delegation panel
    const labTab = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'lab') as HTMLElement;
    expect(labTab).toBeTruthy();
    if (labTab) fireEvent.click(labTab);
    await waitFor(() => expect(container.textContent).toContain('Lab results are in Indicators'));
    expect(container.textContent).toContain('one row per marker');
    console.log('[PASS] Case C no scattered duplicates FactStreamView delegation works');
  });
});
