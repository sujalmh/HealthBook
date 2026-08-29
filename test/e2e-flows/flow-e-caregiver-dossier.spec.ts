/**
 * Acceptance Flow E: Family Care Circle Proxy Switch & Time-Bound Doctor Handover — REAL DATA (M3)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runFlowETests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[Flow E] ${name}: ${err.message || err}`);
    }
  }

  await test('Flow E E2E: Caregiver Proxy Switch & Specialist Handover Workflow', async () => {
    const { engine, context, vault } = createTestHarness('user_raj_son', 'caregiver');

    // Step E.1: Caregiver logs in and switches profile to linked patient (generic test-patient-001)
    const switchRes = await engine.execute('switch_profile', {
      targetPatientId: 'test-patient-001'
    }, context);
    assert(switchRes.success, 'Step E.1: Profile switch must succeed');
    assertEquals(switchRes.data.isProxyActive, true, 'Step E.1: Proxy banner must be active');
    assertEquals(context.patientId, 'test-patient-001', 'Step E.1: Active patient ID updated');

    // Step E.2: Caregiver reviews pending dosage proposal and approves on behalf — generic Patient
    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      currentDose: '1000mg BID',
      proposedDose: '500mg BID',
      reason: 'Protect kidney function due to eGFR 28'
    }, context);

    const actRes = await engine.execute('act_on_behalf', {
      actionName: 'approve_dosage_change',
      actionPayload: { proposalId: propRes.data.id }
    }, context);
    assert(actRes.success, 'Step E.2: Act on behalf must succeed');
    // M3 generic: onBehalfOf is Patient/Test Patient, not hardcoded Shanti — accept any Family member / caregiver generic
    assert(actRes.data.performedBy.toLowerCase().includes('on behalf of'), 'Step E.2: Records proxy audit signature');
    assert(actRes.data.performedBy.includes('Patient') || actRes.data.performedBy.includes('Test Patient') || actRes.data.performedBy.toLowerCase().includes('family'), 'Should be on behalf of Patient');

    // Step E.3: Prepares for new Nephrologist consult -> compiles Continuity Dossier
    const dossierRes = await engine.execute('compile_health_record', {
      patientId: 'test-patient-001',
      sections: ['all']
    }, context);
    assert(dossierRes.success, 'Step E.3: Continuity Dossier compilation must succeed');
    assert(!!dossierRes.data.patientProfile, 'Step E.3: Demographics and profile present');
    assert(Array.isArray(dossierRes.data.caregiverProxyAuditTrail), 'Step E.3: Proxy audit trail included in dossier');

    // Step E.4: Click source citation for historical CKD 3b diagnosis -> pans/zooms to exact bounding box
    const citeRes = await engine.execute('view_timeline', {
      itemId: 'fact_ckd_stage_3b_diagnosis'
    }, context);
    assert(citeRes.success, 'Step E.4: Source citation retrieval must succeed');
    assertEquals(citeRes.data.documentId, 'doc_consult_note_nephrology_006');
    assertEquals(citeRes.data.boundingBox.x, 120, 'Step E.4: Exact x coordinate matched');
    assertEquals(citeRes.data.boundingBox.y, 340, 'Step E.4: Exact y coordinate matched');
    assertEquals(citeRes.data.boundingBox.width, 220, 'Step E.4: Exact width coordinate matched');
    assertEquals(citeRes.data.boundingBox.height, 45, 'Step E.4: Exact height coordinate matched');

    // Step E.5: Grant time-bound 7-day access to Dr. Chen
    const grantRes = await engine.execute('grant_doctor_access', {
      doctorEmail: 'dr.chen@nephrology.org',
      durationDays: 7,
      scope: 'full_dossier'
    }, context);
    assert(grantRes.success, 'Step E.5: Doctor access grant must succeed');
    assertContains(grantRes.data.token, 'cc_tok_', 'Step E.5: Generates ephemeral security token');
    assertEquals(grantRes.data.status, 'active');

    // Step E.6: Test emergency access revocation
    const revokeRes = await engine.execute('revoke_access', {
      grantId: grantRes.data.grantId
    }, context);
    assert(revokeRes.success, 'Step E.6: Revocation must succeed');
    assertEquals(revokeRes.data.status, 'revoked', 'Step E.6: Token status invalidated immediately');

    const grantInVault = vault.getDoctorGrant(grantRes.data.grantId);
    assertEquals(grantInVault?.status, 'revoked', 'Step E.6: Vault reflects revoked status');
  });

  return { passed, failed, errors };
}
