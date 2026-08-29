/**
 * Tier 1 Unit Tests: LabStory Causal Biomarker Engine (M2)
 * Tools: extract_labs, correlate_meds (>=5 tests each)
 */
import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
export async function runLabStoryToolsTests() {
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
            errors.push(`[LabStoryTools] ${name}: ${err.message || err}`);
        }
    }
    // --- Tool 1: extract_labs (5 tests) ---
    await test('TC-LS01-01: extract_labs - longitudinal 5-year biomarker panel ingestion', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('extract_labs', { documentId: 'doc_historical_labs_2022_2026' }, context);
        assert(res.success, 'Extraction should succeed');
        assert(Array.isArray(res.data), 'Data should be array of lab records');
        assert(res.data.length >= 20, 'Should extract multi-year biomarker records');
    });
    await test('TC-LS01-02: extract_labs - unit normalization and reference ranges attachment', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('extract_labs', { documentId: 'doc_historical_labs_2022_2026' }, context);
        const creatRecord = res.data.find((r) => r.marker === 'Creatinine');
        assert(!!creatRecord, 'Creatinine record must exist');
        assertEquals(creatRecord.unit, 'mg/dL');
        assertEquals(creatRecord.referenceRange.high, 1.2);
    });
    await test('TC-LS01-03: extract_labs - critical low eGFR flag detection', async () => {
        const { engine, context } = createTestHarness('p_jenkins_72');
        const res = await engine.execute('extract_labs', { documentId: 'doc_jenkins_labs' }, context);
        const criticalEgfr = res.data.find((r) => r.marker === 'eGFR' && r.value < 30);
        assert(!!criticalEgfr, 'eGFR < 30 should be tagged');
        assertEquals(criticalEgfr.flag, 'LOW');
    });
    await test('TC-LS01-04: extract_labs - duckdb timeseries chronologic placement', async () => {
        const { engine, context, vault } = createTestHarness();
        await engine.execute('extract_labs', { documentId: 'doc_historical_labs_2022_2026' }, context);
        const sortedCreats = vault.getLabs(context.patientId, 'Creatinine');
        assert(sortedCreats.length > 1, 'Should have multiple creatinine records');
        const firstDate = new Date(sortedCreats[0].drawDate).getTime();
        const lastDate = new Date(sortedCreats[sortedCreats.length - 1].drawDate).getTime();
        assert(firstDate <= lastDate, 'Labs must be in chronological ascending order');
    });
    await test('TC-LS01-05: extract_labs - validation error when documentId is missing', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('extract_labs', {}, context);
        assert(!res.success, 'Validation should fail if documentId is missing');
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 2: correlate_meds (5 tests) ---
    await test('TC-LS02-01: correlate_meds - eGFR decline vs NSAID & Metformin correlation', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('correlate_meds', { biomarker: 'eGFR' }, context);
        assert(res.success, 'Correlation query should succeed');
        assertContains(res.data.causalStorySentence, 'eGFR declined', 'Story sentence must explain decline');
        assertContains(res.data.correlatedMedications, 'Metformin', 'Must correlate Metformin');
    });
    await test('TC-LS02-02: correlate_meds - Glucose spikes vs Prednisone burst timing', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('correlate_meds', { biomarker: 'Glucose Fasting' }, context);
        assert(res.success, 'Query should succeed');
        assertContains(res.data.causalStorySentence, 'Prednisone', 'Should mention Prednisone burst');
    });
    await test('TC-LS02-03: correlate_meds - Potassium vs ACEi/Diuretic additive effect', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('correlate_meds', { biomarker: 'Potassium' }, context);
        assert(res.success, 'Query should succeed');
        assertContains(res.data.causalStorySentence, 'Potassium', 'Should analyze potassium trends');
    });
    await test('TC-LS02-04: correlate_meds - Generates targeted doctor question for Question Bank', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('correlate_meds', { biomarker: 'Creatinine' }, context);
        assert(!!res.data.recommendedDoctorQuestion, 'Must generate recommended doctor question');
        assertContains(res.data.recommendedDoctorQuestion, 'Creatinine');
    });
    await test('TC-LS02-05: correlate_meds - validation error on empty biomarker parameter', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('correlate_meds', {}, context);
        assert(!res.success, 'Should fail validation without biomarker');
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    return { passed, failed, errors };
}
