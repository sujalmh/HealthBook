/**
 * Tier 4 Test Suite: Real-World Complex Patient Journey Workload Scenarios
 * Tests: Harold Jenkins (CKD 3b + T2D + HFpEF) & Shanti Devi (Post-PCI + AFib + Proxy Caregiver)
 */
import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
export async function runRealWorldWorkloadsTests() {
    let passed = 0;
    let failed = 0;
    const errors = [];
    async function test(name, fn) {
        try {
            await fn();
            passed++;
        }
        catch (err) {
            failed++;
            errors.push(`[Workload] ${name}: ${err.message || err}`);
        }
    }
    // Workload 1: Harold Jenkins Complex Multi-Morbid Journey
    await test('WL-01: Harold Jenkins - Complete 5-stage longitudinal post-discharge journey', async () => {
        const { engine, context, vault } = createTestHarness('p_jenkins_72', 'patient');
        context.activeProfile.name = 'Harold Jenkins';
        // Stage 1: Discharge Reconciliation & St. John's Wort Flag
        const explainRes = await engine.execute('explain_med_change', {
            medName: 'Sacubitril/Valsartan',
            preHospDose: 'None',
            inHospAction: 'Initiated post Lisinopril washout',
            dischargeDose: '49/51mg BID'
        }, context);
        assert(explainRes.success);
        assertEquals(explainRes.data.statusBadge, 'NEW');
        const ddiRes = await engine.execute('check_interactions', {
            medList: ['Sacubitril/Valsartan', 'Carvedilol', 'Metformin', 'Furosemide', 'St. John\'s Wort']
        }, context);
        assert(ddiRes.success);
        // Stage 2: LabStory Causal Analysis
        await engine.execute('extract_labs', { documentId: 'doc_jenkins_5y_labs' }, context);
        const corrRes = await engine.execute('correlate_meds', { biomarker: 'eGFR' }, context);
        assert(corrRes.success);
        assertContains(corrRes.data.causalStorySentence, 'eGFR declined');
        // Stage 3: HomeLab Remote Slip & Caregiver Proxy Approval
        const uploadRes = await engine.execute('upload_lab_image', { imageBlob: 'data:image/jpeg;base64,jenkins_remote_slip' }, context);
        assert(uploadRes.success);
        const propRes = await engine.execute('propose_dosage_change', {
            medName: 'Metformin',
            currentDose: '1000mg BID',
            proposedDose: '500mg BID',
            reason: 'eGFR dropped to 26 mL/min'
        }, context);
        assert(propRes.success);
        // Daughter Susan Jenkins approves on behalf
        const actRes = await engine.execute('act_on_behalf', {
            actionName: 'approve_dosage_change',
            actionPayload: { proposalId: propRes.data.id }
        }, {
            ...context,
            activeProfile: {
                userId: 'user_susan_daughter',
                name: 'Susan Jenkins',
                role: 'caregiver',
                isProxy: true,
                onBehalfOf: 'Harold Jenkins',
                permissionLevel: 'manage'
            }
        });
        assert(actRes.success);
        assertContains(actRes.data.performedBy, 'Susan Jenkins on behalf of Harold Jenkins');
        // Stage 4: Safety Danger Sign Escalation & Doctor Remote Pill Adjustment
        const dangerRes = await engine.execute('report_danger_sign', {
            symptomTags: ['edema_feet', 'dyspnea'],
            freeText: '5-pound weight gain in 2 days and noticeable ankle swelling.',
            severityRating: 'severe'
        }, context);
        assert(dangerRes.success);
        const doctorAction = await engine.execute('doctor_change_dose', {
            medName: 'Furosemide',
            newDose: '80mg QD',
            reason: 'Temporary fluid overload diuresis'
        }, context);
        assert(doctorAction.success);
        const followRes = await engine.execute('schedule_followup', {
            date: '+3d',
            reason: 'Heart failure fluid retention re-evaluation'
        }, context);
        assert(followRes.success);
        // Stage 5: Continuity Dossier Export & Specialist Access Token
        const dossierRes = await engine.execute('compile_health_record', { patientId: 'p_jenkins_72' }, context);
        assert(dossierRes.success);
        const grantRes = await engine.execute('grant_doctor_access', {
            doctorEmail: 'dr.evans@heartfailure.org',
            durationDays: 14,
            scope: 'full_dossier'
        }, context);
        assert(grantRes.success);
        assertEquals(grantRes.data.durationDays, 14);
    });
    // Workload 2: Shanti Devi Multi-Disciplinary Care Circle Journey
    await test('WL-02: Shanti Devi - Post-PCI, diet interactions, and audited proxy management', async () => {
        const { engine, context, vault } = createTestHarness('patient-s-devi', 'patient');
        // Stage 1: Document OCR Fact Extraction
        const extractRes = await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
        assert(extractRes.success);
        assertEquals(extractRes.data.length, 8);
        // Stage 2: Fact Confirmations
        for (const f of extractRes.data) {
            await engine.execute('confirm_fact', { factId: f.id, action: 'approve' }, context);
        }
        const confirmed = vault.getFactsByPatient('patient-s-devi', 'confirmed');
        assertEquals(confirmed.length, 8);
        // Stage 3: Diet & Food Interactions Evaluation
        const dietRes = await engine.execute('check_diet_interactions', {
            medList: ['Atorvastatin', 'Levothyroxine', 'Apixaban', 'Metformin'],
            patientDiet: { drinksGrapefruitDaily: true, dairyBreakfast: true }
        }, context);
        assert(dietRes.success);
        assert(dietRes.data.length >= 2, 'Must detect Grapefruit and Empty stomach rules');
        // Stage 4: Doctor Question Bank Aggregation
        await engine.execute('suggest_question_for_doctor', {
            context: 'Lisinopril stopped and need kidney monitoring',
            medName: 'Lisinopril',
            autoAddToBank: true
        }, context);
        await engine.execute('suggest_question_for_doctor', {
            context: 'Taking fish oil with new Apixaban',
            medName: 'Apixaban',
            autoAddToBank: true
        }, context);
        const questions = vault.getQuestions('patient-s-devi');
        assertEquals(questions.length, 2);
        // Stage 5: Caregiver Raj Proxy Profile Switch & Audit
        const switchRes = await engine.execute('switch_profile', { targetPatientId: 'patient-s-devi' }, {
            ...context,
            activeProfile: {
                userId: 'user_raj_son',
                name: 'Raj Devi',
                role: 'caregiver',
                isProxy: false
            }
        });
        assert(switchRes.success);
        assertEquals(switchRes.data.isProxyActive, true);
        // Stage 6: Grounded Document Source Highlighting
        const citeRes = await engine.execute('view_timeline', { itemId: 'fact_ckd_stage_3b_diagnosis' }, context);
        assert(citeRes.success);
        assertEquals(citeRes.data.boundingBox.x, 120);
        assertEquals(citeRes.data.boundingBox.y, 340);
    });
    return { passed, failed, errors };
}
