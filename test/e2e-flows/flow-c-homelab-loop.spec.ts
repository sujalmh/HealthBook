/**
 * Acceptance Flow C: HomeLab Remote Prescribed Loop — REAL DATA (M3)
 * (Due Card -> Photo Upload -> Doctor Triage Note & Dose Reduction -> PillMap Diff & LabStory Band)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runFlowCTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[Flow C] ${name}: ${err.message || err}`);
    }
  }

  await test('Flow C E2E: Prescribed HomeLab Closed-Loop Workflow', async () => {
    const { engine, context, vault } = createTestHarness('test-patient-001', 'patient');

    // Step C.1: Set up initial active regimen and prescribed lab due card
    await vault.addMedication({
      id: 'med_metformin',
      patientId: context.patientId,
      genericName: 'Metformin',
      dosage: '1000mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active'
    }, { userId: 'u1', userName: 'User', role: 'patient' });

    vault.dueCards.set('due_creat_01', {
      id: 'due_creat_01',
      patientId: context.patientId,
      testPanel: 'Serum Creatinine & eGFR',
      biomarkers: ['Creatinine', 'eGFR'],
      dueDate: '2026-09-08T00:00:00Z',
      prescribedBy: 'Dr. A. Patel, MD',
      prescribedDate: '2026-08-25T00:00:00Z',
      instructions: 'Repeat kidney function test at home or local lab.',
      status: 'due_soon'
    });

    const dueCard = vault.dueCards.get('due_creat_01');
    assert(!!dueCard, 'Step C.1: Due card displayed');
    assertEquals(dueCard?.status, 'due_soon');

    // Step C.2: Patient captures and uploads photo of remote lab slip — real parseable text (not opaque base64)
    const uploadRes = await engine.execute('upload_lab_image', {
      imageBlob: 'Creatinine 1.90 mg/dL; eGFR 28 mL/min/1.73m2; Potassium 4.8 mEq/L',
      linkedDueCardId: 'due_creat_01'
    }, context);
    assert(uploadRes.success, 'Step C.2: Lab photo slip upload must succeed');
    // Real-data parsing should narrate the parsed values
    assertContains(uploadRes.plainLanguageSummary, '1.9', 'Step C.2: Narrates Creatinine 1.9');
    assertContains(uploadRes.plainLanguageSummary, '28', 'Step C.2: Narrates eGFR 28');

    // Step C.3: Human approval gate: Confirm extracted lab values — find staged fact for this patientId
    const unconfirmed = vault.getFactsByPatient(context.patientId, 'unconfirmed');
    assert(unconfirmed.length >= 1, 'Step C.3: Staged facts must exist for patient');
    const creatFact = unconfirmed.find(f => f.name.includes('Creatinine') || f.plainExplanation.includes('Creatinine')) || unconfirmed[0];
    assert(!!creatFact, 'Step C.3: Staged fact must exist');
    await engine.execute('confirm_fact', { factId: creatFact!.id, action: 'approve' }, context);

    const completedDueCard = vault.dueCards.get('due_creat_01');
    assertEquals(completedDueCard?.status, 'completed', 'Step C.3: Due card updated to completed');

    // Step C.4: Doctor reviews alert and attaches pinned comment
    const doctorContext = {
      ...context,
      activeProfile: {
        userId: 'dr_patel_md',
        name: 'Dr. A. Patel, MD',
        role: 'doctor' as const,
        isProxy: false
      }
    };
    const reviewRes = await engine.execute('doctor_review_comment', {
      labId: creatFact!.id,
      commentText: 'eGFR dropped below 30 mL/min; halving Metformin dose to avoid lactic acidosis risk.',
      pinnedMarker: 'Creatinine 2026-08-28'
    }, doctorContext);
    assert(reviewRes.success, 'Step C.4: Doctor comment must succeed');
    assertEquals(reviewRes.data.pinnedMarker, 'Creatinine 2026-08-28');

    // Step C.5: Doctor submits dosage reduction proposal
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      currentDose: '1000mg BID',
      proposedDose: '500mg BID',
      reason: 'Protect kidney function due to recent lab result (eGFR 28)',
      linkedLabId: creatFact!.id
    }, doctorContext);
    assert(propRes.success, 'Step C.5: Dosage proposal creation must succeed');
    assertEquals(propRes.data.status, 'pending', 'Step C.5: Proposal must remain in pending state');

    // Step C.6: Patient reviews Dosage Proposal Card and approves change
    const approveRes = await engine.execute('approve_dosage_change', {
      proposalId: propRes.data.id,
      action: 'approve'
    }, context);
    assert(approveRes.success, 'Step C.6: Patient approval must succeed');
    assertEquals(approveRes.data.status, 'approved', 'Step C.6: Proposal status transitioned to approved');

    // Step C.7: Synchronize PillMap visual diff and LabStory ongoing band
    const syncRes = await engine.execute('sync_pillmap_from_proposal', {
      proposalId: propRes.data.id
    }, context);
    assert(syncRes.success, 'Step C.7: PillMap sync must succeed');
    assertEquals(syncRes.data.newDose, '500mg BID');
    assert(!!syncRes.data.labStoryInterventionBand, 'Step C.7: LabStory intervention band must be generated');

    // Step C.8: Doctor sets next due date (Creatinine in 4 weeks)
    const nextLabRes = await engine.execute('schedule_lab', {
      cadence: '4_weeks',
      testPanel: 'Repeat Creatinine & Potassium'
    }, doctorContext);
    assert(nextLabRes.success, 'Step C.8: Next lab due date auto-set');
  });

  return { passed, failed, errors };
}
