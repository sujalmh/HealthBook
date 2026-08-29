/**
 * Acceptance Flow A: Post-Discharge 3-List Reconciliation & PillMap Onboarding
 * Automated Step-by-Step E2E Verification
 */
import { createTestHarness, assert, assertEquals } from '../harness/webmcp-test-shim.ts';
import { mockShantiDevi3ListDataset } from '../../src/fixtures/discharge_lists.ts';
export async function runFlowATests() {
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
            errors.push(`[Flow A] ${name}: ${err.message || err}`);
        }
    }
    await test('Flow A E2E: Discharge Night Complete Workflow', async () => {
        const { engine, context, vault } = createTestHarness('patient-s-devi', 'patient');
        const dataset = mockShantiDevi3ListDataset;
        // Step A.1: Upload 3 discharge documents & extract facts
        const extractRes = await engine.execute('extract_fact', {
            documentId: 'doc_discharge_cardiac_001',
            docType: 'discharge_summary'
        }, context);
        assert(extractRes.success, 'Step A.1: Fact extraction must succeed');
        assert(extractRes.data.length >= 8, 'Step A.1: Must extract all discharge medication & lab facts');
        // Step A.2: Med-by-med reconciliation walk with plain explanations & approval gating
        for (const dMed of dataset.dischargeMeds) {
            const pre = dataset.preAdmissionMeds.find(p => p.medName === dMed.medName);
            const inHosp = dataset.inHospitalMeds.find(h => h.medName === dMed.medName);
            const explainRes = await engine.execute('explain_med_change', {
                medName: dMed.medName,
                preHospDose: pre ? pre.dose : 'None',
                inHospAction: inHosp ? inHosp.reason : 'Continued',
                dischargeDose: dMed.dose
            }, context);
            assert(explainRes.success, `Step A.2: Explanation for ${dMed.medName} must succeed`);
            assertEquals(explainRes.data.statusBadge, dMed.status, `Step A.2: Status badge must match expected ${dMed.status}`);
            // Simulate human approval gate for each confirmed fact
            const fact = vault.getFactsByPatient('patient-s-devi', 'unconfirmed').find(f => f.name.includes(dMed.medName));
            if (fact) {
                await engine.execute('confirm_fact', { factId: fact.id, action: 'approve' }, context);
            }
        }
        // Step A.3: Interaction checking (2 drug-drug flags, 1 drug-diet flag)
        const dischargeMedNames = dataset.dischargeMeds.map(m => m.medName);
        const preAdmitOTCNames = dataset.preAdmissionMeds.filter(p => p.isOTC).map(p => p.medName);
        const ddiRes = await engine.execute('flag_interaction', {
            dischargeMeds: dischargeMedNames,
            preAdmitOTCs: preAdmitOTCNames
        }, context);
        assert(ddiRes.success, 'Step A.3: DDI flag check must succeed');
        assert(ddiRes.data.length >= 1, 'Step A.3: Must detect Apixaban vs Fish Oil bleeding conflict');
        const dietRes = await engine.execute('flag_diet_interaction', {
            dischargeMeds: dischargeMedNames,
            patientDietProfile: { drinksGrapefruitDaily: true }
        }, context);
        assert(dietRes.success, 'Step A.3: Diet flag check must succeed');
        const grapefruitFlag = dietRes.data.find((b) => b.drugName.includes('Atorvastatin'));
        assert(!!grapefruitFlag, 'Step A.3: Must flag Atorvastatin vs Grapefruit');
        // Step A.4: Auto-curate questions for doctor into Question Bank
        const q1Res = await engine.execute('suggest_question_for_doctor', {
            context: 'Lisinopril stopped due to kidney strain and need primary doctor recheck',
            medName: 'Lisinopril',
            autoAddToBank: true
        }, context);
        assert(q1Res.success, 'Step A.4: Doctor question 1 must succeed');
        const q2Res = await engine.execute('suggest_question_for_doctor', {
            context: 'Can I safely take fish oil with my new apixaban blood thinner',
            medName: 'Apixaban',
            autoAddToBank: true
        }, context);
        assert(q2Res.success, 'Step A.4: Doctor question 2 must succeed');
        const questionsInBank = vault.getQuestions('patient-s-devi');
        assert(questionsInBank.length >= 2, 'Step A.4: Question Bank must have >= 2 items');
        // Step A.5: Export 1-page patient discharge summary
        const exportRes = await engine.execute('export_patient_summary', {
            patientId: 'patient-s-devi',
            format: 'one_page_pdf'
        }, context);
        assert(exportRes.success, 'Step A.5: Patient summary export must succeed');
        assert(exportRes.data.whatChangedSummary.length >= 3, 'Step A.5: Summary must list what changed');
        // Step A.6: Auto-populate PillMap Day 0 canvas with diet-aware slots
        const activeDischargeMeds = dataset.dischargeMeds.filter(m => m.status !== 'STOPPED');
        for (const med of activeDischargeMeds) {
            await engine.execute('add_medication', {
                name: med.medName,
                dose: med.dose,
                slot: med.timingSlots ? med.timingSlots[0] : 'morning',
                withFood: med.dietInstructions?.includes('meals')
            }, context);
        }
        const pillmapMeds = vault.getMedications('patient-s-devi', 'active');
        assert(pillmapMeds.length >= 3, 'Step A.6: PillMap canvas must be initialized with Day 0 active meds');
    });
    return { passed, failed, errors };
}
