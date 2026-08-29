/**
 * CareCanvas Automated Test Runner
 * Standalone verification runner for Tiers 1-4 Test Suites and Acceptance Flows A through E.
 */
// Tier 1 Feature Suites
import { runVaultToolsTests } from './tier1-feature/vault-tools.spec.ts';
import { runLabStoryToolsTests } from './tier1-feature/labstory-tools.spec.ts';
import { runPillMapToolsTests } from './tier1-feature/pillmap-tools.spec.ts';
import { runRxBridgeToolsTests } from './tier1-feature/rxbridge-tools.spec.ts';
import { runHomeLabToolsTests } from './tier1-feature/homelab-tools.spec.ts';
import { runSafetyToolsTests } from './tier1-feature/safety-tools.spec.ts';
import { runCareCircleDossierToolsTests } from './tier1-feature/carecircle-dossier-tools.spec.ts';
// Tier 2 Boundary Suite
import { runBoundaryStressTests } from './tier2-boundary/boundary-stress.spec.ts';
// Tier 3 Integration Suite
import { runCrossModuleIntegrationTests } from './tier3-integration/cross-module-integration.spec.ts';
// Tier 4 Workload Suite
import { runRealWorldWorkloadsTests } from './tier4-workloads/real-world-workloads.spec.ts';
// E2E Flows A-E
import { runFlowATests } from './e2e-flows/flow-a-discharge-night.spec.ts';
import { runFlowBTests } from './e2e-flows/flow-b-weekly-pillmap.spec.ts';
import { runFlowCTests } from './e2e-flows/flow-c-homelab-loop.spec.ts';
import { runFlowDTests } from './e2e-flows/flow-d-safety-escalation.spec.ts';
import { runFlowETests } from './e2e-flows/flow-e-caregiver-dossier.spec.ts';
async function runTestSuite(name, category, runner) {
    const start = performance.now();
    try {
        const res = await runner();
        const duration = performance.now() - start;
        return {
            suiteName: name,
            category,
            passed: res.passed,
            failed: res.failed,
            durationMs: duration,
            errors: res.errors
        };
    }
    catch (err) {
        const duration = performance.now() - start;
        return {
            suiteName: name,
            category,
            passed: 0,
            failed: 1,
            durationMs: duration,
            errors: [`Fatal error in suite "${name}": ${err.message || err}`]
        };
    }
}
async function main() {
    const args = process.argv.slice(2);
    const filterTier1 = args.includes('--tier1');
    const filterTier2 = args.includes('--tier2');
    const filterTier3 = args.includes('--tier3');
    const filterTier4 = args.includes('--tier4');
    const filterE2E = args.includes('--e2e');
    const runAll = !filterTier1 && !filterTier2 && !filterTier3 && !filterTier4 && !filterE2E;
    console.log('\n' + '='.repeat(80));
    console.log('  CareCanvas Automated Test Runner — Comprehensive E2E Verification');
    console.log('='.repeat(80) + '\n');
    const suiteResults = [];
    const globalStart = performance.now();
    // --- Tier 1: Exhaustive Tool & Feature Coverage ---
    if (runAll || filterTier1) {
        console.log('▶ Executing Tier 1: Feature Coverage Suites (>=5 tests per tool across 40 tools)...');
        suiteResults.push(await runTestSuite('Vault Tools (extract_fact, confirm_fact, compile_health_record)', 'Tier 1', runVaultToolsTests));
        suiteResults.push(await runTestSuite('LabStory Tools (extract_labs, correlate_meds)', 'Tier 1', runLabStoryToolsTests));
        suiteResults.push(await runTestSuite('PillMap Tools (8 polypharmacy & schedule tools)', 'Tier 1', runPillMapToolsTests));
        suiteResults.push(await runTestSuite('RxBridge Tools (5 post-discharge reconciliation tools)', 'Tier 1', runRxBridgeToolsTests));
        suiteResults.push(await runTestSuite('HomeLab Tools (5 remote prescribed loop tools)', 'Tier 1', runHomeLabToolsTests));
        suiteResults.push(await runTestSuite('Safety Tools (9 danger triage, doctor control & calendar tools)', 'Tier 1', runSafetyToolsTests));
        suiteResults.push(await runTestSuite('Care Circle & Dossier Tools (8 proxy & handover tools)', 'Tier 1', runCareCircleDossierToolsTests));
    }
    // --- Tier 2: Boundary & Stress Tests ---
    if (runAll || filterTier2) {
        console.log('▶ Executing Tier 2: Boundary, Stress & Edge Case Suites...');
        suiteResults.push(await runTestSuite('Boundary & Stress (T2-01 to T2-12)', 'Tier 2', runBoundaryStressTests));
    }
    // --- Tier 3: Cross-Module Integration ---
    if (runAll || filterTier3) {
        console.log('▶ Executing Tier 3: Cross-Module Integration Matrix (INT-01 to INT-12)...');
        suiteResults.push(await runTestSuite('Cross-Module Pairwise Integration (12 Channels)', 'Tier 3', runCrossModuleIntegrationTests));
    }
    // --- Tier 4: Real-World Workloads ---
    if (runAll || filterTier4) {
        console.log('▶ Executing Tier 4: Complex Multi-Morbid Workload Scenarios...');
        suiteResults.push(await runTestSuite('Real-World Workloads (Harold Jenkins & Shanti Devi)', 'Tier 4', runRealWorldWorkloadsTests));
    }
    // --- E2E Acceptance Flows A-E ---
    if (runAll || filterE2E) {
        console.log('▶ Executing E2E Acceptance Flows A through E...');
        suiteResults.push(await runTestSuite('Flow A: Discharge Night Reconciliation & Day 0 PillMap', 'E2E Flows', runFlowATests));
        suiteResults.push(await runTestSuite('Flow B: Weekly Living Polypharmacy & Adherence', 'E2E Flows', runFlowBTests));
        suiteResults.push(await runTestSuite('Flow C: Prescribed HomeLab Closed-Loop', 'E2E Flows', runFlowCTests));
        suiteResults.push(await runTestSuite('Flow D: Safety Alert Escalation & Remote Pillbox', 'E2E Flows', runFlowDTests));
        suiteResults.push(await runTestSuite('Flow E: Family Care Circle Proxy & Doctor Handover', 'E2E Flows', runFlowETests));
    }
    const globalDuration = performance.now() - globalStart;
    // Print Detailed Report
    console.log('\n' + '-'.repeat(80));
    console.log('  TEST EXECUTION SUMMARY');
    console.log('-'.repeat(80));
    let totalPassed = 0;
    let totalFailed = 0;
    const allErrors = [];
    for (const s of suiteResults) {
        totalPassed += s.passed;
        totalFailed += s.failed;
        allErrors.push(...s.errors);
        const statusIcon = s.failed === 0 ? '✅ PASS' : '❌ FAIL';
        const timing = `${s.durationMs.toFixed(1)}ms`.padStart(8);
        console.log(`  ${statusIcon} [${s.category.padEnd(9)}] ${s.suiteName.padEnd(52)} ${s.passed} passed (${timing})`);
    }
    console.log('='.repeat(80));
    console.log(`  TOTAL TESTS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed} | TIME: ${globalDuration.toFixed(1)}ms`);
    console.log('='.repeat(80));
    if (allErrors.length > 0) {
        console.log('\n❌ FAILURE DETAILS:');
        allErrors.forEach(err => console.log(`  - ${err}`));
        process.exit(1);
    }
    else {
        console.log('\n🎉 ALL CARECANVAS TEST SUITES AND E2E ACCEPTANCE FLOWS PASSED (100% SUCCESS)\n');
        process.exit(0);
    }
}
main().catch(err => {
    console.error('Fatal unhandled error in test runner:', err);
    process.exit(1);
});
