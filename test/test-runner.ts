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

interface SuiteResult {
  suite: string;
  tier: string;
  passed: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

export async function runAllSuites(): Promise<void> {
  const args = typeof process !== 'undefined' ? process.argv.slice(2) : [];
  const filterTier1 = args.includes('--tier1');
  const filterTier2 = args.includes('--tier2');
  const filterTier3 = args.includes('--tier3');
  const filterTier4 = args.includes('--tier4');
  const filterE2E = args.includes('--e2e');
  const runAll = !filterTier1 && !filterTier2 && !filterTier3 && !filterTier4 && !filterE2E;

  console.log('\n🏥 ═══════════════════════════════════════════════════════════════════════');
  console.log('   CareCanvas WebMCP Verification & Test Suite Runner');
  console.log('   Autonomous Patient-Facing Health Companion Engine');
  console.log('═════════════════════════════════════════════════════════════════════════\n');

  const results: SuiteResult[] = [];

  const runSuite = async (name: string, tier: string, fn: () => Promise<{ passed: number; failed: number; errors: string[] }>) => {
    process.stdout.write(`  ▶ Running ${tier} [${name}]... `);
    const start = performance.now();
    try {
      const res = await fn();
      const duration = Math.round(performance.now() - start);
      if (res.failed === 0) {
        console.log(`\x1b[32m✔ PASS\x1b[0m (${res.passed} tests, ${duration}ms)`);
      } else {
        console.log(`\x1b[31m✖ FAIL\x1b[0m (${res.passed} passed, ${res.failed} failed, ${duration}ms)`);
        for (const err of res.errors) {
          console.log(`    \x1b[31m• ${err}\x1b[0m`);
        }
      }
      results.push({ suite: name, tier, durationMs: duration, ...res });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      console.log(`\x1b[31m✖ CRASH\x1b[0m: ${err.message || err}`);
      results.push({ suite: name, tier, passed: 0, failed: 1, durationMs: duration, errors: [String(err.message || err)] });
    }
  };

  // Tier 1: Unit Tools (42 tools >= 5 tests each = ~210 tests)
  if (runAll || filterTier1) {
    console.log('📦 TIER 1: Tool Verification & Behavioral Specifications');
    await runSuite('Module 0: Approved Fact Vault', 'Tier 1', runVaultToolsTests);
    await runSuite('Module 1: LabStory & Correlator', 'Tier 1', runLabStoryToolsTests);
    await runSuite('Module 2: PillMap & Negotiator', 'Tier 1', runPillMapToolsTests);
    await runSuite('Module 3: RxBridge & Reconciliation', 'Tier 1', runRxBridgeToolsTests);
    await runSuite('Module 4: HomeLab & Feedback Loop', 'Tier 1', runHomeLabToolsTests);
    await runSuite('Module 5: Safety Alerts & Calendar', 'Tier 1', runSafetyToolsTests);
    await runSuite('Module 6: Care Circle & Dossier', 'Tier 1', runCareCircleDossierToolsTests);
  }

  // Tier 2: Boundary & Edge Cases
  if (runAll || filterTier2) {
    console.log('\n🛡️ TIER 2: Boundary, Concurrency & Security Stress');
    await runSuite('Boundary & Stress Cases (T2-01 to T2-12)', 'Tier 2', runBoundaryStressTests);
  }

  // Tier 3: Cross-Module Integration
  if (runAll || filterTier3) {
    console.log('\n🔗 TIER 3: Cross-Module Reactive Data Flow');
    await runSuite('Cross-Module Pipelines (INT-01 to INT-12)', 'Tier 3', runCrossModuleIntegrationTests);
  }

  // Tier 4: Real-World Clinical Workloads
  if (runAll || filterTier4) {
    console.log('\n🏥 TIER 4: Complex Real-World Patient Workloads');
    await runSuite('Clinical Workloads (Harold Jenkins & Shanti Devi)', 'Tier 4', runRealWorldWorkloadsTests);
  }

  // E2E User Journeys
  if (runAll || filterE2E) {
    console.log('\n🚀 E2E WORKFLOWS: High-Stakes Patient/Caregiver Journeys');
    await runSuite('Flow A: Discharge Night First-Aid & Fact Extraction', 'E2E', runFlowATests);
    await runSuite('Flow B: Weekly PillMap & Chronotype Alignment', 'E2E', runFlowBTests);
    await runSuite('Flow C: HomeLab AKI Detection & Remote Titration Loop', 'E2E', runFlowCTests);
    await runSuite('Flow D: Safety Alert Escalation & Remote Pillbox', 'E2E', runFlowDTests);
    await runSuite('Flow E: Family Care Circle Proxy & Doctor Handover', 'E2E', runFlowETests);
  }

  // Summary
  const totalPassed = results.reduce((acc, r) => acc + r.passed, 0);
  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);
  const totalTests = totalPassed + totalFailed;

  console.log('\n═════════════════════════════════════════════════════════════════════════');
  if (totalFailed === 0) {
    console.log(`\x1b[32m🎉 ALL ${totalTests} TESTS PASSED CLEANLY!\x1b[0m`);
    console.log(`   Suites: ${results.length} | Tests: ${totalPassed} passed, 0 failed`);
  } else {
    console.log(`\x1b[31m⚠️ TEST SUITE FAILURES DETECTED:\x1b[0m`);
    console.log(`   Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
    process.exit(1);
  }
  console.log('═════════════════════════════════════════════════════════════════════════\n');
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('test-runner')) {
  runAllSuites();
}
