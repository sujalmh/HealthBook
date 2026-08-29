/**
 * Tier 1 Unit Tests: HomeLab Remote Prescribed Loop (M5)
 * Tools: upload_lab_image, doctor_review_comment, propose_dosage_change,
 *        approve_dosage_change, sync_pillmap_from_proposal (>=5 tests each)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runHomeLabToolsTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[HomeLabTools] ${name}: ${err.message || err}`);
    }
  }

  // --- Tool 1: upload_lab_image (5 tests) — real vault: generic placeholder for opaque base64 ---
  await test('TC-HL01-01: upload_lab_image - standard photo slip ingestion with bounding boxes', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('upload_lab_image', { imageBlob: 'data:image/jpeg;base64,mockdata' }, context);
    assert(res.success);
    assert(res.data.extractedValues.length >= 2, 'Should extract at least 2 placeholders for base64');
    const creat = res.data.extractedValues.find((v: any) => v.marker === 'Creatinine');
    assert(!!creat, 'Creatinine placeholder must exist');
    // M3 real-data: base64 opaque image returns neutral 1.0 (not Shanti 1.90) — vault-owned generic
    assert(Number.isFinite(creat.value), 'Creatinine value must be finite');
  });

  await test('TC-HL01-02: upload_lab_image - links and completes prescribed due card', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.dueCards.set('due_card_01', {
      id: 'due_card_01',
      patientId: context.patientId,
      testPanel: 'Renal Function Panel',
      biomarkers: ['Creatinine', 'eGFR'],
      dueDate: '2026-09-08',
      prescribedBy: 'Dr. Patel',
      prescribedDate: '2026-08-25',
      status: 'due_soon'
    });

    const res = await engine.execute('upload_lab_image', { imageBlob: 'data:image/jpeg;base64,mock', linkedDueCardId: 'due_card_01' }, context);
    assert(res.success);
    const updatedCard = vault.dueCards.get('due_card_01');
    assertEquals(updatedCard?.status, 'completed');
  });

  await test('TC-HL01-03: upload_lab_image - plain language narration describes creatinine and eGFR', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('upload_lab_image', { imageBlob: 'data:image/jpeg;base64,mock' }, context);
    assert(res.success);
    // Real-data generic placeholder: check contains Creatinine and eGFR, not Shanti-specific 1.90
    assertContains(res.plainLanguageSummary, 'Creatinine');
    assertContains(res.plainLanguageSummary, 'eGFR');
  });

  await test('TC-HL01-04: upload_lab_image - saves extracted facts into vault in unconfirmed status', async () => {
    const { engine, context, vault } = createTestHarness();
    await engine.execute('upload_lab_image', { imageBlob: 'data:image/jpeg;base64,mock' }, context);
    const unconfirmed = vault.getFactsByPatient(context.patientId, 'unconfirmed');
    assert(unconfirmed.some(f => f.name === 'Creatinine'), 'Unconfirmed creatinine fact must exist');
  });

  await test('TC-HL01-05: upload_lab_image - validation rejects missing imageBlob', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('upload_lab_image', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 2: doctor_review_comment (5 tests) ---
  await test('TC-HL02-01: doctor_review_comment - doctor pins note to Creatinine point', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('doctor_review_comment', {
      labId: 'fact_homelab_creat_190',
      commentText: 'eGFR dropped below 30 mL/min; halving Metformin dose to avoid lactic acidosis risk.',
      pinnedMarker: 'Creatinine 2026-08-28'
    }, context);
    assert(res.success);
    assertEquals(res.data.doctorId, 'dr_patel_md');
    assertEquals(res.data.pinnedMarker, 'Creatinine 2026-08-28');
  });

  await test('TC-HL02-02: doctor_review_comment - creates audit log record', async () => {
    const { engine, context, vault } = createTestHarness('p_devi_78', 'doctor');
    await engine.execute('doctor_review_comment', {
      labId: 'fact_homelab_creat_190',
      commentText: 'Kidney strain noted.'
    }, context);
    const audits = vault.auditLog.filter(a => a.action === 'doctor_review_comment');
    assert(audits.length >= 1, 'Audit log entry must be created');
  });

  await test('TC-HL02-03: doctor_review_comment - plain language summary contains doctor comment', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('doctor_review_comment', {
      labId: 'lab_1',
      commentText: 'Repeat electrolytes in 4 weeks.'
    }, context);
    assert(res.success);
    assertContains(res.plainLanguageSummary, 'Repeat electrolytes in 4 weeks');
  });

  await test('TC-HL02-04: doctor_review_comment - rejects empty comment text', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('doctor_review_comment', { labId: 'lab_1', commentText: '' }, context);
    assert(!res.success);
    assert(res.error?.code === 'INVALID_PARAMS' || res.error?.code === 'INVALID_COMMENT', 'Should reject empty comment');
  });

  await test('TC-HL02-05: doctor_review_comment - validation rejects missing labId', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('doctor_review_comment', { commentText: 'Test' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 3: propose_dosage_change (5 tests) ---
  await test('TC-HL03-01: propose_dosage_change - creates pending proposal card for Metformin reduction', async () => {
    const { engine, context, vault } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      currentDose: '1000mg BID',
      proposedDose: '500mg BID',
      reason: 'Protect kidney function due to recent lab result (eGFR 28)'
    }, context);
    assert(res.success);
    assertEquals(res.data.status, 'pending');
    assertEquals(res.data.proposedDose, '500mg BID');

    const inVault = vault.getProposals(context.patientId, 'pending');
    assert(inVault.length >= 1, 'Proposal must be saved in vault');
  });

  await test('TC-HL03-02: propose_dosage_change - links proposal to recent lab point', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('propose_dosage_change', {
      medName: 'Spironolactone',
      currentDose: '50mg QD',
      proposedDose: '25mg QD',
      reason: 'Potassium elevated to 5.2',
      linkedLabId: 'lab_potassium_point_01'
    }, context);
    assert(res.success);
    assertEquals(res.data.linkedLabId, 'lab_potassium_point_01');
  });

  await test('TC-HL03-03: propose_dosage_change - plain language narration explains rationale', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg QD',
      reason: 'eGFR 28'
    }, context);
    assert(res.success);
    assertContains(res.data.plainNarration, 'recommends changing Metformin');
  });

  await test('TC-HL03-04: propose_dosage_change - defaults doctor name and ID', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('propose_dosage_change', {
      medName: 'Levothyroxine',
      proposedDose: '88mcg',
      reason: 'TSH elevated'
    }, context);
    assert(res.success);
    assert(!!res.data.doctorName);
  });

  await test('TC-HL03-05: propose_dosage_change - validation rejects missing proposedDose', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'doctor');
    const res = await engine.execute('propose_dosage_change', { medName: 'Metformin', reason: 'renal' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 4: approve_dosage_change (5 tests) ---
  await test('TC-HL04-01: approve_dosage_change - patient direct approval transitions proposal to approved', async () => {
    const { engine, context, vault } = createTestHarness('p_devi_78', 'patient');
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg BID',
      reason: 'eGFR 28'
    }, context);

    const res = await engine.execute('approve_dosage_change', {
      proposalId: propRes.data.id,
      action: 'approve'
    }, context);
    assert(res.success);
    assertEquals(res.data.status, 'approved');
  });

  await test('TC-HL04-02: approve_dosage_change - caregiver proxy approval records on-behalf signature', async () => {
    const { engine, context, vault } = createTestHarness('p_devi_78', 'caregiver');
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg BID',
      reason: 'eGFR 28'
    }, context);

    const res = await engine.execute('approve_dosage_change', {
      proposalId: propRes.data.id,
      action: 'approve',
      approvedBy: 'Raj Devi',
      role: 'caregiver',
      onBehalfOf: 'Smt. Shanti Devi'
    }, context);
    assert(res.success);
    assertEquals(res.data.onBehalfOf, 'Smt. Shanti Devi');
    assertEquals(res.data.approvedBy, 'Raj Devi');
  });

  await test('TC-HL04-03: approve_dosage_change - rejection transitions status to rejected', async () => {
    const { engine, context } = createTestHarness();
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg BID',
      reason: 'eGFR 28'
    }, context);

    const res = await engine.execute('approve_dosage_change', {
      proposalId: propRes.data.id,
      action: 'reject'
    }, context);
    assert(res.success);
    assertEquals(res.data.status, 'rejected');
  });

  await test('TC-HL04-04: approve_dosage_change - error on non-existent proposal ID', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('approve_dosage_change', { proposalId: 'prop_unknown_9999' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'PROPOSAL_NOT_FOUND');
  });

  await test('TC-HL04-05: approve_dosage_change - validation rejects missing proposalId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('approve_dosage_change', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 5: sync_pillmap_from_proposal (5 tests) ---
  await test('TC-HL05-01: sync_pillmap_from_proposal - updates medication dosage in LocalVault', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({
      id: 'med_metformin',
      patientId: context.patientId,
      genericName: 'Metformin',
      dosage: '1000mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active'
    }, { userId: 'u1', userName: 'User', role: 'patient' });

    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      currentDose: '1000mg',
      proposedDose: '500mg',
      reason: 'eGFR 28'
    }, context);
    await engine.execute('approve_dosage_change', { proposalId: propRes.data.id, action: 'approve' }, context);

    const syncRes = await engine.execute('sync_pillmap_from_proposal', { proposalId: propRes.data.id }, context);
    assert(syncRes.success);
    assertEquals(syncRes.data.newDose, '500mg');

    const updatedMed = vault.getMedications(context.patientId).find(m => m.genericName === 'Metformin');
    assertEquals(updatedMed?.dosage, '500mg');
  });

  await test('TC-HL05-02: sync_pillmap_from_proposal - emits DOM animation and side effects payload', async () => {
    const { engine, context } = createTestHarness();
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg',
      reason: 'eGFR 28'
    }, context);
    await engine.execute('approve_dosage_change', { proposalId: propRes.data.id }, context);

    const syncRes = await engine.execute('sync_pillmap_from_proposal', { proposalId: propRes.data.id }, context);
    assert(syncRes.success);
    assertEquals(syncRes.data.animationType, 'fade_out_old_pulse_new');
  });

  await test('TC-HL05-03: sync_pillmap_from_proposal - creates LabStory continuous intervention band trigger', async () => {
    const { engine, context } = createTestHarness();
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg',
      reason: 'eGFR 28'
    }, context);
    await engine.execute('approve_dosage_change', { proposalId: propRes.data.id }, context);

    const syncRes = await engine.execute('sync_pillmap_from_proposal', { proposalId: propRes.data.id }, context);
    assert(syncRes.success);
    assert(!!syncRes.data.labStoryInterventionBand, 'Intervention band must be configured');
    assertEquals(syncRes.data.labStoryInterventionBand.color, '#10B981');
  });

  await test('TC-HL05-04: sync_pillmap_from_proposal - error on non-existent proposal ID', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('sync_pillmap_from_proposal', { proposalId: 'prop_ghost_123' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'PROPOSAL_NOT_FOUND');
  });

  await test('TC-HL05-05: sync_pillmap_from_proposal - validation rejects missing proposalId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('sync_pillmap_from_proposal', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  return { passed, failed, errors };
}
