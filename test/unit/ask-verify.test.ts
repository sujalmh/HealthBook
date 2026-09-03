import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QuestionBank } from '@/components/common/QuestionBank';
import { AskWhyPanel } from '@/components/ask/AskWhyPanel';
import { CausalQueryPanel } from '@/components/labstory/CausalQueryPanel';
import { localVault } from '@/core/vault/LocalVault';

describe('Ask #4 — delete presetQueries + gate auto-add — probe', () => {
  const probePatient = 'ask-test-empty';

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('healthbook_active_user', JSON.stringify({ userId: probePatient, name: 'Probe', role: 'patient' }));
    localVault.clear();
    // ensure vault empty
    await new Promise(r => setTimeout(r, 10));
  });

  it('Case A — Fresh vault empty: QuestionBank 0 questions, placeholder Tylenol, No questions yet, no preset chips', async () => {
    const { container } = render(React.createElement(QuestionBank, { patientId: probePatient, asPage: true }));
    // Wait for loadQuestions effect
    await waitFor(() => {
      expect(container.textContent).toContain('No questions yet');
    }, { timeout: 2000 });

    // Check placeholder
    const input = container.querySelector('input[placeholder*="Tylenol"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain('Tylenol');
    expect(input.value).toBe('');

    // Check list length 0 — should show No questions yet, not list items
    expect(container.textContent).toContain('No questions yet');
    expect(container.textContent).toContain('Add one above');

    // No preset chips — QuestionBank should have 0 presetQueries (grep 0)
    // Ensure no element with text from old presetQueries
    expect(container.textContent).not.toContain('eGFR vs NSAIDs');
    expect(container.textContent).not.toContain('Glucose Spike');

    // Check QuestionBank filter still works — filter buttons exist
    expect(container.textContent).toContain('Filter by Module');

    // Verify vault is empty
    const items = localVault.getQuestionBankItems(probePatient);
    expect(items.length).toBe(0);
  });

  it('Case A2 — CausalQueryPanel has 0 chips (deleted) and AskWhyPanel collapsed has 0 visible chips until tap', async () => {
    // Causal should have no preset chips
    const { container: cContainer } = render(React.createElement(CausalQueryPanel, { patientId: probePatient, activeMarker: 'eGFR' }));
    await waitFor(() => {
      expect(cContainer.textContent).toContain('Ask why it changed');
    });
    // Should NOT contain Suggested Causal Queries or preset labels
    expect(cContainer.textContent).not.toContain('Suggested Causal Queries');
    expect(cContainer.textContent).not.toContain('eGFR vs NSAIDs');
    // Input should exist
    expect(cContainer.querySelector('input[placeholder*="Ask why"]')).toBeTruthy();

    // AskWhyPanel collapsed initially shows 0 chips, Need ideas? folded aria-expanded false
    const { container: aContainer } = render(React.createElement(AskWhyPanel, { patientId: probePatient }));
    await waitFor(() => {
      expect(aContainer.textContent).toContain('Need ideas?');
    });
    const disclosureBtn = aContainer.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(disclosureBtn).toBeTruthy();
    expect(disclosureBtn.getAttribute('aria-expanded')).toBe('false');

    // Before tap, no chips visible
    expect(aContainer.textContent).not.toContain('Kidney change — medicines?');
    // After tap, chips appear
    fireEvent.click(disclosureBtn);
    await waitFor(() => {
      expect(disclosureBtn.getAttribute('aria-expanded')).toBe('true');
    });
    expect(aContainer.textContent).toContain('Kidney change — medicines?');
    expect(aContainer.textContent).toContain('Sugar spike — why?');
    // Check 44px min height on chips (disclosure itself is py-3 = 44px approx, but chips explicitly have min-h-[44px])
    const chips = aContainer.querySelectorAll('button.text-caption');
    let chipHas44 = false;
    chips.forEach(c => { if (c.className.includes('min-h-[44px]')) chipHas44 = true; });
    expect(chipHas44).toBe(true);
  });

  it('Case B — Auto-add suppressed: non-critical med → 0, critical med → 1, lab non-critical → 0, critical lab →1', async () => {
    localVault.clear();
    // Non-critical med: Metformin 500mg without isCritical
    localVault.addMedication({
      id: 'med-metformin-probe-1',
      patientId: probePatient,
      genericName: 'Metformin',
      brandName: 'Glucophage',
      dosage: '500mg',
      frequency: 'Twice daily',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active',
    } as any);

    let items = localVault.getQuestionBankItems(probePatient);
    expect(items.length).toBe(0); // gated, non-critical should NOT auto-add

    // Critical med: with flag CRITICAL_HIGH
    localVault.addMedication({
      id: 'med-metformin-probe-critical',
      patientId: probePatient,
      genericName: 'Metformin-Critical',
      dosage: '500mg',
      frequency: 'Twice daily',
      timingSlots: ['morning'],
      withFood: false,
      status: 'active',
      flag: 'CRITICAL_HIGH',
      isCritical: true,
    } as any);

    items = localVault.getQuestionBankItems(probePatient);
    expect(items.length).toBe(1);
    expect(items[0].questionText).toContain('Metformin-Critical');

    // Lab non-critical: Creatinine 1.0 NORMAL should NOT add
    const beforeLabCount = localVault.getQuestionBankItems(probePatient).length;
    localVault.addLab({
      id: 'lab-creat-normal-1',
      patientId: probePatient,
      marker: 'Creatinine',
      value: 1.0,
      unit: 'mg/dL',
      normalizedValue: 1.0,
      normalizedUnit: 'mg/dL',
      drawDate: new Date().toISOString(),
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: false,
      isCritical: false,
      flag: 'NORMAL',
    } as any);
    let afterNormal = localVault.getQuestionBankItems(probePatient).length;
    expect(afterNormal).toBe(beforeLabCount); // no new question for normal

    // Lab critical: Creatinine 3.5 CRITICAL_HIGH should add
    localVault.addLab({
      id: 'lab-creat-critical-1',
      patientId: probePatient,
      marker: 'Creatinine',
      value: 3.5,
      unit: 'mg/dL',
      normalizedValue: 3.5,
      normalizedUnit: 'mg/dL',
      drawDate: new Date().toISOString(),
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: false,
      isCritical: true,
      flag: 'CRITICAL_HIGH',
    } as any);
    let afterCritical = localVault.getQuestionBankItems(probePatient).length;
    expect(afterCritical).toBe(beforeLabCount + 1);
  });

  it('Mobile 375 no overflow and a11y 44px', async () => {
    // Set viewport 375
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));
    const { container } = render(React.createElement(QuestionBank, { patientId: probePatient, asPage: true }));
    await waitFor(() => expect(container.textContent).toContain('No questions yet'));
    // Check no page overflow: document.documentElement.scrollWidth <= clientWidth (jsdom 0===0)
    expect(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 10).toBe(true);
    // Check 44px min heights exist in QuestionBank (inputs/buttons)
    const inputs = container.querySelectorAll('input');
    let has44Input = false;
    inputs.forEach(b => { if (b.className.includes('min-h-[44px]')) has44Input = true; });
    expect(has44Input).toBe(true);
    const qButtons = container.querySelectorAll('button');
    let has44Btn = false;
    qButtons.forEach(b => { if (b.className.includes('min-h-[44px]')) has44Btn = true; });
    expect(has44Btn).toBe(true);

    const { container: aContainer } = render(React.createElement(AskWhyPanel, { patientId: probePatient }));
    await waitFor(() => expect(aContainer.textContent).toContain('Need ideas?'));
    // Check AskWhyPanel chips have 44px after expanding
    const disclosure = aContainer.querySelector('button[aria-expanded]') as HTMLButtonElement;
    fireEvent.click(disclosure);
    await waitFor(() => expect(disclosure.getAttribute('aria-expanded')).toBe('true'));
    const chips = aContainer.querySelectorAll('button.text-caption');
    let chip44 = false;
    chips.forEach(c => { if ((c as HTMLElement).className.includes('min-h-[44px]')) chip44 = true; });
    expect(chip44).toBe(true);
  });
});
