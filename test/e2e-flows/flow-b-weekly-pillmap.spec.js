/**
 * Acceptance Flow B: Weekly Pillbox & Polypharmacy Negotiator (PillMap)
 * Automated Step-by-Step E2E Verification
 */
import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
export async function runFlowBTests() {
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
            errors.push(`[Flow B] ${name}: ${err.message || err}`);
        }
    }
    await test('Flow B E2E: Weekly PillMap Visual Polypharmacy & Adherence Simulation', async () => {
        const { engine, context, vault } = createTestHarness('p_jenkins_72', 'patient');
        // Step B.1: Render active 7x4 weekly pillbox canvas with baseline meds
        await engine.execute('add_medication', { name: 'Sertraline', dose: '50mg', slot: 'morning' }, context);
        await engine.execute('add_medication', { name: 'Apixaban', dose: '5mg', slot: 'morning' }, context);
        await engine.execute('add_medication', { name: 'Metformin', dose: '1000mg', slot: 'morning', withFood: true }, context);
        await engine.execute('add_medication', { name: 'Atorvastatin', dose: '40mg', slot: 'morning' }, context); // intentionally placed in morning to test optimization
        const activeMeds = vault.getMedications('p_jenkins_72', 'active');
        assertEquals(activeMeds.length, 4, 'Step B.1: Baseline medications loaded');
        // Step B.2: Drag OTC supplement (St. John's Wort) onto morning slot -> triggers orange MAJOR SVG conflict arcs
        await engine.execute('add_medication', { name: 'St. John\'s Wort', dose: '300mg', slot: 'morning' }, context);
        const activeNames = vault.getMedications('p_jenkins_72', 'active').map(m => m.genericName);
        const ddiRes = await engine.execute('check_interactions', { medList: activeNames }, context);
        assert(ddiRes.success, 'Step B.2: Interaction evaluation must succeed');
        const serotoninArc = ddiRes.data.find((a) => /sertraline/i.test(`${a.drugA} ${a.drugB}`));
        assert(!!serotoninArc, 'Step B.2: Orange MAJOR SVG arc must be drawn between St. John\'s Wort and Sertraline (FDA warning-level, not contraindication)');
        assertEquals(serotoninArc.severity, 'MAJOR');
        assertEquals(serotoninArc.arcColor, '#F97316');
        const orangeArc = ddiRes.data.find((a) => a.severity === 'MAJOR' && /apixaban/i.test(`${a.drugA} ${a.drugB}`));
        assert(!!orangeArc, 'Step B.2: Orange MAJOR SVG arc must be drawn for Apixaban interaction');
        // Step B.3: Click serotonin SVG arc to view plain-language clinical mechanism
        assertContains(serotoninArc.mechanism, 'Serotonin Syndrome', 'Step B.3: Bottom sheet mechanism must detail Serotonin Syndrome');
        assertContains(serotoninArc.clinicalGuidance, 'discontinue', 'Step B.3: Guidance must advise discontinuing St. John\'s Wort');
        // Step B.4: Schedule optimization request -> generates ghost previews
        const schedRes = await engine.execute('suggest_schedule', {
            medList: [
                { id: 'm_atorva', name: 'Atorvastatin', currentSlot: 'morning' },
                { id: 'm_met', name: 'Metformin', currentSlot: 'morning' }
            ],
            chronotype: 'night_owl'
        }, context);
        assert(schedRes.success, 'Step B.4: Schedule suggestion must succeed');
        const atorvaShift = schedRes.data.proposedShifts.find((s) => s.medName === 'Atorvastatin');
        assert(!!atorvaShift, 'Step B.4: Ghost preview shift must move Atorvastatin to bedtime');
        assertEquals(atorvaShift.toSlot, 'bedtime');
        // Step B.5: User approves schedule shift -> commit to vault
        await engine.execute('add_medication', { name: 'Atorvastatin', dose: '40mg', slot: 'bedtime' }, context);
        // Step B.6: Missed dose adherence simulation -> drag Metformin off canvas
        const simRes = await engine.execute('simulate_adherence', {
            medName: 'Metformin',
            slot: { day: 'tuesday', slot: 'morning' }
        }, context);
        assert(simRes.success, 'Step B.6: Adherence simulation must succeed');
        assertContains(simRes.data.clinicalImpactSummary, 'glucose', 'Step B.6: Impact must mention peak glucose delta');
        assertEquals(simRes.data.doNotDoubleDoseWarning, true, 'Step B.6: Must include do not double dose warning');
        // Step B.7: Export 1-page visual map for pharmacist
        const exportRes = await engine.execute('export_for_pharmacist', {
            patientId: 'p_jenkins_72',
            format: 'pdf_map'
        }, context);
        assert(exportRes.success, 'Step B.7: Pharmacist export must succeed');
        assert(exportRes.data.brandGenericCrosswalk.length >= 3, 'Step B.7: Must include brand/generic crosswalk');
    });
    return { passed, failed, errors };
}
