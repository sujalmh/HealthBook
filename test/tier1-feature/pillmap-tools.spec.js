/**
 * Tier 1 Unit Tests: PillMap Polypharmacy Negotiator (M3)
 * Tools: add_medication, check_interactions, check_diet_interactions, check_duplicate_ingredient,
 *        suggest_schedule, simulate_adherence, export_for_pharmacist, set_reminder (>=5 tests each)
 */
import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
export async function runPillMapToolsTests() {
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
            errors.push(`[PillMapTools] ${name}: ${err.message || err}`);
        }
    }
    // --- Tool 1: add_medication (5 tests) ---
    await test('TC-PM01-01: add_medication - standard morning slot placement', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('add_medication', { name: 'Lisinopril', dose: '10mg', slot: 'morning' }, context);
        assert(res.success, 'Addition should succeed');
        assertEquals(res.data.timingSlots[0], 'morning');
    });
    await test('TC-PM01-02: add_medication - bedtime placement with brand name resolution', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('add_medication', { name: 'Lipitor', dose: '40mg', slot: 'bedtime' }, context);
        assert(res.success);
        assertEquals(res.data.genericName, 'Atorvastatin');
        assertEquals(res.data.timingSlots[0], 'bedtime');
    });
    await test('TC-PM01-03: add_medication - withFood instructions preserved', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('add_medication', { name: 'Metformin', dose: '500mg', slot: 'evening', withFood: true }, context);
        assert(res.success);
        assertEquals(res.data.withFood, true);
    });
    await test('TC-PM01-04: add_medication - invalid slot validation rejection', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('add_medication', { name: 'Aspirin', dose: '81mg', slot: 'midnight_snack' }, context);
        assert(!res.success, 'Invalid slot must be rejected');
        assertEquals(res.error?.code, 'INVALID_SLOT');
    });
    await test('TC-PM01-05: add_medication - missing required dose parameter', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('add_medication', { name: 'Aspirin', slot: 'morning' }, context);
        assert(!res.success, 'Missing dose must fail schema validation');
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 2: check_interactions (5 tests) ---
    await test('TC-PM02-01: check_interactions - Red Contraindicated arc between Sertraline and St. John\'s Wort', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_interactions', { medList: ['Sertraline', 'St. John\'s Wort'] }, context);
        assert(res.success);
        assert(res.data.length >= 1, 'Conflict arc must be generated');
        const arc = res.data[0];
        assertEquals(arc.severity, 'CONTRAINDICATED');
        assertEquals(arc.arcColor, '#EF4444');
        assertContains(arc.mechanism, 'Serotonin Syndrome');
    });
    await test('TC-PM02-02: check_interactions - Orange Major arc between Apixaban and Fish Oil', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_interactions', { medList: ['Apixaban', 'Fish Oil'] }, context);
        assert(res.success);
        const arc = res.data.find((a) => a.drugA.includes('Apixaban') || a.drugB.includes('Apixaban'));
        assert(!!arc, 'Apixaban-Fish Oil conflict must be detected');
        assertEquals(arc.severity, 'MAJOR');
        assertEquals(arc.arcColor, '#F97316');
    });
    await test('TC-PM02-03: check_interactions - Calcium Carbonate vs Ciprofloxacin chelation', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_interactions', { medList: ['Ciprofloxacin', 'Calcium Carbonate'] }, context);
        assert(res.success);
        const arc = res.data[0];
        assertEquals(arc.severity, 'MAJOR');
        assertContains(arc.mechanism, 'chelates');
    });
    await test('TC-PM02-04: check_interactions - Clean non-conflicting regimen returns empty arcs array', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_interactions', { medList: ['Levothyroxine', 'Metformin'] }, context);
        assert(res.success);
        assertEquals(res.data.length, 0);
    });
    await test('TC-PM02-05: check_interactions - defaults to vault active medications when medList omitted', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_interactions', {}, context);
        assert(res.success);
        assert(Array.isArray(res.data));
    });
    // --- Tool 3: check_diet_interactions (5 tests) ---
    await test('TC-PM03-01: check_diet_interactions - Atorvastatin + Grapefruit amber badge', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_diet_interactions', { medList: ['Atorvastatin'], patientDiet: { drinksGrapefruitDaily: true } }, context);
        assert(res.success);
        const badge = res.data[0];
        assert(!!badge, 'Grapefruit badge must be returned');
        assertContains(badge.badgeText, 'Grapefruit');
        assertEquals(badge.severity, 'MAJOR');
    });
    await test('TC-PM03-02: check_diet_interactions - Warfarin + Vitamin K greens badge', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_diet_interactions', { medList: ['Warfarin'], patientDiet: { frequentHighVitKGreens: true } }, context);
        assert(res.success);
        const badge = res.data[0];
        assertContains(badge.badgeText, 'Consistent Vit K');
    });
    await test('TC-PM03-03: check_diet_interactions - Levothyroxine empty stomach requirement', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_diet_interactions', { medList: ['Levothyroxine'], patientDiet: {} }, context);
        assert(res.success);
        const badge = res.data.find((b) => b.drugName === 'Levothyroxine');
        assert(!!badge, 'Empty stomach badge must be attached to Levothyroxine');
        assertContains(badge.badgeText, 'Empty Stomach');
    });
    await test('TC-PM03-04: check_diet_interactions - Metronidazole + Alcohol contraindicated badge', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_diet_interactions', { medList: ['Metronidazole'], patientDiet: {} }, context);
        assert(res.success);
        const badge = res.data[0];
        assertEquals(badge.severity, 'CONTRAINDICATED');
        assertContains(badge.badgeText, 'Zero Alcohol');
    });
    await test('TC-PM03-05: check_diet_interactions - validation fails on missing medList', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_diet_interactions', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 4: check_duplicate_ingredient (5 tests) ---
    await test('TC-PM04-01: check_duplicate_ingredient - Tylenol + Percocet APAP cumulative limit alert', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_duplicate_ingredient', { medList: [{ name: 'Tylenol', dose: '500mg' }, { name: 'Percocet', dose: '5/325mg' }] }, context);
        assert(res.success);
        assert(res.data.length >= 1, 'Must detect duplicate Acetaminophen');
        const alert = res.data[0];
        assertEquals(alert.ingredient, 'Acetaminophen');
    });
    await test('TC-PM04-02: check_duplicate_ingredient - Advil + Aleve dual NSAID toxicity detection', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_duplicate_ingredient', { medList: [{ name: 'Advil', dose: '200mg' }, { name: 'Aleve', dose: '220mg' }] }, context);
        assert(res.success);
        const alert = res.data.find((a) => a.ingredient === 'NSAID Class');
        assert(!!alert, 'Must flag concurrent dual NSAID intake');
    });
    await test('TC-PM04-03: check_duplicate_ingredient - Lipitor + Atorvastatin brand/generic overlap', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_duplicate_ingredient', { medList: [{ name: 'Lipitor', dose: '40mg' }, { name: 'Atorvastatin', dose: '40mg' }] }, context);
        assert(res.success);
        const alert = res.data.find((a) => a.ingredient === 'Atorvastatin');
        assert(!!alert, 'Must flag identical chemical duplicate');
    });
    await test('TC-PM04-04: check_duplicate_ingredient - clean distinct medications returns no alerts', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_duplicate_ingredient', { medList: [{ name: 'Metformin', dose: '500mg' }, { name: 'Levothyroxine', dose: '75mcg' }] }, context);
        assert(res.success);
        assertEquals(res.data.length, 0);
    });
    await test('TC-PM04-05: check_duplicate_ingredient - validation error when medList missing', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('check_duplicate_ingredient', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 5: suggest_schedule (5 tests) ---
    await test('TC-PM05-01: suggest_schedule - shifts Atorvastatin from morning to bedtime', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('suggest_schedule', {
            medList: [{ id: 'm1', name: 'Atorvastatin', currentSlot: 'morning' }],
            chronotype: 'night_owl'
        }, context);
        assert(res.success);
        const shift = res.data.proposedShifts.find((s) => s.medName === 'Atorvastatin');
        assert(!!shift, 'Must propose shifting Atorvastatin');
        assertEquals(shift.toSlot, 'bedtime');
    });
    await test('TC-PM05-02: suggest_schedule - shifts Furosemide away from bedtime to morning', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('suggest_schedule', {
            medList: [{ id: 'm2', name: 'Furosemide', currentSlot: 'bedtime' }],
            chronotype: 'standard'
        }, context);
        assert(res.success);
        const shift = res.data.proposedShifts.find((s) => s.medName === 'Furosemide');
        assert(!!shift);
        assertEquals(shift.toSlot, 'morning');
    });
    await test('TC-PM05-03: suggest_schedule - separates Calcium Carbonate from morning Levothyroxine', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('suggest_schedule', {
            medList: [{ id: 'm3', name: 'Calcium Carbonate', currentSlot: 'morning' }],
            chronotype: 'early_bird'
        }, context);
        assert(res.success);
        const shift = res.data.proposedShifts.find((s) => s.medName === 'Calcium Carbonate');
        assert(!!shift);
        assertEquals(shift.toSlot, 'noon');
    });
    await test('TC-PM05-04: suggest_schedule - already optimal schedule returns 0 shifts', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('suggest_schedule', {
            medList: [{ id: 'm4', name: 'Levothyroxine', currentSlot: 'morning' }],
            chronotype: 'standard'
        }, context);
        assert(res.success);
        assertEquals(res.data.proposedShifts.length, 0);
    });
    await test('TC-PM05-05: suggest_schedule - validation error when medList missing', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('suggest_schedule', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 6: simulate_adherence (5 tests) ---
    await test('TC-PM06-01: simulate_adherence - missed Metformin clinical risk delta', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('simulate_adherence', { medName: 'Metformin', slot: { day: 'tuesday', slot: 'morning' } }, context);
        assert(res.success);
        assertContains(res.data.clinicalImpactSummary, 'glucose');
        assertEquals(res.data.doNotDoubleDoseWarning, true);
    });
    await test('TC-PM06-02: simulate_adherence - missed Apixaban half-life decay warning', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('simulate_adherence', { medName: 'Apixaban' }, context);
        assert(res.success);
        assertContains(res.data.clinicalImpactSummary.toLowerCase(), 'anticoagulant');
    });
    await test('TC-PM06-03: simulate_adherence - missed Amlodipine blood pressure rebound projection', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('simulate_adherence', { medName: 'Amlodipine' }, context);
        assert(res.success);
        assertContains(res.data.projectedBiomarkerDelta?.estimatedChange, 'mmHg');
    });
    await test('TC-PM06-04: simulate_adherence - general med recovery instructions', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('simulate_adherence', { medName: 'Allopurinol' }, context);
        assert(res.success);
        assertContains(res.data.recoveryProtocol, 'as soon as remembered');
    });
    await test('TC-PM06-05: simulate_adherence - validation rejects missing medName', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('simulate_adherence', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 7: export_for_pharmacist (5 tests) ---
    await test('TC-PM07-01: export_for_pharmacist - exports active regimen with brand/generic crosswalk', async () => {
        const { engine, context } = createTestHarness();
        await engine.execute('add_medication', { name: 'Lipitor', dose: '40mg', slot: 'bedtime' }, context);
        const res = await engine.execute('export_for_pharmacist', { patientId: context.patientId, format: 'pdf_map' }, context);
        assert(res.success);
        assert(res.data.brandGenericCrosswalk.length >= 1);
        assertEquals(res.data.brandGenericCrosswalk[0].generic, 'Atorvastatin');
    });
    await test('TC-PM07-02: export_for_pharmacist - includes pharmacist signature block', async () => {
        const { engine, context } = createTestHarness();
        await engine.execute('add_medication', { name: 'Metformin', dose: '1000mg', slot: 'morning' }, context);
        const res = await engine.execute('export_for_pharmacist', { patientId: context.patientId }, context);
        assert(res.success);
        assert(!!res.data.pharmacistSignatureBlock, 'Signature block must be present');
    });
    await test('TC-PM07-03: export_for_pharmacist - JSON format selection', async () => {
        const { engine, context } = createTestHarness();
        await engine.execute('add_medication', { name: 'Apixaban', dose: '5mg', slot: 'morning' }, context);
        const res = await engine.execute('export_for_pharmacist', { patientId: context.patientId, format: 'json' }, context);
        assert(res.success);
        assertEquals(res.data.format, 'json');
    });
    await test('TC-PM07-04: export_for_pharmacist - empty regimen error guard', async () => {
        const { engine, context } = createTestHarness('p_empty_patient_77');
        const res = await engine.execute('export_for_pharmacist', { patientId: 'p_empty_patient_77' }, context);
        assert(!res.success, 'Cannot export empty schedule');
        assertEquals(res.error?.code, 'CANVAS_EMPTY');
    });
    await test('TC-PM07-05: export_for_pharmacist - validation rejects missing patientId', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('export_for_pharmacist', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 8: set_reminder (5 tests) ---
    await test('TC-PM08-01: set_reminder - sets morning and bedtime time slot reminders', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('set_reminder', { slotTimes: { morning: '08:00', bedtime: '22:00' } }, context);
        assert(res.success);
        assertEquals(res.data.registeredSlots.length, 2);
    });
    await test('TC-PM08-02: set_reminder - persists reminders into LocalVault calendar store', async () => {
        const { engine, context, vault } = createTestHarness();
        await engine.execute('set_reminder', { slotTimes: { noon: '12:30' } }, context);
        const events = vault.getCalendarEvents(context.patientId);
        assert(events.some(e => e.eventType === 'med_reminder'), 'Med reminder event must be saved in vault');
    });
    await test('TC-PM08-03: set_reminder - 4-slot full daily schedule configuration', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('set_reminder', {
            slotTimes: { morning: '08:00', noon: '13:00', evening: '19:00', bedtime: '22:30' }
        }, context);
        assert(res.success);
        assertEquals(res.data.registeredSlots.length, 4);
    });
    await test('TC-PM08-04: set_reminder - plain summary confirms registered slots', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('set_reminder', { slotTimes: { morning: '07:30' } }, context);
        assert(res.success);
        assertContains(res.plainLanguageSummary, 'morning');
    });
    await test('TC-PM08-05: set_reminder - validation rejects missing slotTimes', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('set_reminder', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    return { passed, failed, errors };
}
