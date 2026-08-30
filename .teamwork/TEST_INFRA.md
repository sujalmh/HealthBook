# TEST_INFRA.md — CareCanvas WebMCP Hackathon (teamwork-1788075497934)

Synthesized: 2026-08-30T13:30Z from spec-miner synthesis + prior verification delta + vite.config harness
Integrity: demo reproducible verifiable not mocked — Q7
Working Dir: /Users/sujal/Projects/proj1/.teamwork

## Test Commands (baseline 1660 modules, 172 vitest / 231 runner PASS prior, lint 0)

- npm run lint -> tsc --noEmit — expected EXIT 0, 0 errors — gate per milestone + Success Auditor, log .teamwork/logs/lint.log
- npm test -> vitest run (globals:true, jsdom, setup test/setup.ts clearAll) — expected 172+ PASS (currently 172) — after WebMCP fix must stay 172+ PASS, test/unit/WebMCPEngine.test.ts 4 tests still 40 via engine direct + new native probe via document.modelContext.getTools() shim
- npx tsx test/test-runner.ts (npm run test:all) -> custom harness 231 tests across 15 suites — Tier1 40 tools 200 tests (vault 3 + labstory 2 + pillmap 8 + rxbridge 5 + homelab 5 + safety 9 + carecircle 8) + Tier2 T2-01..12 + Tier3 INT-01..12 + Tier4 workloads + E2E Flows A-E — expected ALL 231 PASS — after fix must stay 231 PASS, logs .teamwork/logs/tier3.log
- npm run build -> tsc && vite build — expected EXIT 0, 1660±delta modules dist valid (prior 1660 at success auditor, dist assets JS 793kB gz190kB CSS 72kB) — log .teamwork/logs/build.log
- Tier splits: npm run test:tools --tier1, test:tier2 --tier2, test:tier3 --tier3, test:workloads --tier4, test:e2e:flows --e2e
- Per-file: npx vitest run test/tier3-integration/cohesion.test.ts 28, supabase.test.ts 8
- Native probe (manual/browser): In Chrome 149 flag localhost: await document.modelContext.getTools() length 40, JSON.parse(inputSchema) PASS, description non-empty, origin/window present, toolchange event count >=1 after register/unregister, isSecureContext true, executeTool object-based returns DOMString JSON.parse success, patientId correct — logs .teamwork/verification/webmcp-native-probe.log + webmcp-validation.log + toolchange.log
- Fallback parity probe (jsdom/tests): same calls via polyfill shim Promise shapes length 40 — logs webmcp-native-probe.log parity section

## Coverage & Regression Guards (R5 no regression)

- vitest 172 covers LocalVault, vaultTools, pillMap, rxBridge, labStory, continuityDossier, homeLabSafetyCareCircle, teamwork-orchestration, WebMCPEngine — after WebMCP fix vaultTools still 40 tools, localVault scoped counts, pillMap no gap, WebMCPEngine now spec-correct dictionary
- test-runner 231 covers 40 tools + boundary T2 + cross-module INT + workloads + E2E A-E — workloads/profile tests use generic patientId via localStorage carecanvas_active_user not patient-s-devi, after fix must still 231 PASS
- Cohesion invariants (grep -rn) must stay 0 except documented keep:
  - ST. JUDE / Metropolis 0 in src/ (already 0 after prior M1-M3)
  - Dr. Anita Patel / Raj Devi etc 0 in src/ (already 0)
  - p_devi_78 0 in src/ (test legacyMocks allowed, src 0)
  - mockShanti 0 in src/
  - we pronoun 0 in src/components (direct voice) if prior
  - slop 0
  - 40 tools intact via src/tools/index.ts length 40 — grep -R "registerTool" src/core/webmcp/ count >=1 with document.modelContext.registerTool delegation PASS, grep -R "inputSchema" src/types/webmcp.ts src/core/webmcp/ validates adapter, grep -R "parameters" src/tools/ still 40 but adapter converts (not bare native)
  - New WebMCP gates must PASS:
    - grep -R "registerTool" src/core/webmcp/ >=1 with document.modelContext.registerTool delegation PASS
    - grep -R "inputSchema" src/types/webmcp.ts src/core/webmcp/ >=1 PASS
    - grep -Rn "toolchange|ontoolchange" src >=1 after fix PASS (prior 0 bug)
    - grep -R "globalThis.modelContext|window.modelContext|navigator.modelContext|__CareCanvas_WebMCP__" src -- Q2: production grep should be 0 for window/navigator/legacy except test adapter jsdom guard `if (document.modelContext?.registerTool) before overwrite` + test vitest shim may have 1-2 but prod 0 — verifier checks Connect modal shows only document.modelContext examples, not 4 globals
    - grep -R "isSecureContext" src >=1 PASS (bootstrap guard)
    - grep -R "permissionsPolicy.*allowsFeature.*tools|Permissions-Policy" src >=1 or try/catch NotAllowedError check PASS
    - grep -R "Promise.allSettled" src/core/webmcp src/main.tsx >=1 PASS (Q10 not Promise.all)
    - grep -R "AbortController|signal" src/core/webmcp src/main.tsx >=1 PASS (Q3 dedup)
  - Prior product invariants still 0: grep -R "ST. JUDE" src 0 stays 0, etc.

## Snapshot Discipline (live browser mandatory, demo integrity)

- Every worker >=2 browser.capture (desktop 1280 + mobile 375) + tablet 768 under .teamwork/snapshots/webmcp-<milestone>/ ; auditor re-captures independently at 3 viewports
- Required viewports: 320/375/768/1024/1280/1440 — verify no gaps, Inspector shows 40 and correct Native vs Polyfill label, Connect modal shows document.modelContext examples, vault empty No records here yet, Create Account gate still required, after executeTool pending fact visible with correct patientId
- Live dev server npm run dev port 5173, browser.open http://localhost:5173 viewport desktop|mobile|tablet + snapshot + capture ; fallback puppeteer-core justified if browser capture fails — must still produce JPEG valid >5K (file magic JFIF via `file` + `wc -c` >5K)
- Baselines: cold start empty vault before/after each milestone; native probe screenshots under .teamwork/snapshots/webmcp-native/ showing Inspector catalog count 40 and mode label; invoke screenshots under webmcp-invoke showing pending fact at 1280/375/768; UI screenshots under webmcp-ui
- Auditor commands: lint+test+build+grep regrep + live re-capture 3 viewports (desktop 1280 mobile 375 tablet 768) must show Inspector 40, no gaps, JFIF >5K, verification logs present, 6-viewport audit 320-1440 no gaps

## Verification Plan Per Milestone (机械 reproducible probes)

- M1 Core Adapter (R2,R3): critic checks inputSchema mapping JSON.parse PASS, name regex ^[a-z.-]{1,128} PASS, empty name/description InvalidStateError probes, duplicate InvalidStateError, Promise shapes registerTool→Promise<undefined> etc, patientId bridging not '' , lint 0 test 172 build 1660; challenger edge name/description empty, duplicate HMR AbortController, invalid name "bad name!" with space, annotations readOnlyHint, type circular; auditor rebuilds + regreps inputSchema/toolchange/polyfill guard + re-captures 1280/375/768 + 6 viewports no gaps
- M2 Bootstrap Platform (R4,R3 invoke): critic checks isSecureContext guard + PermissionsPolicy allowsFeature/try/catch NotAllowedError, toolchange fires on register/unregister via document.modelContext.addEventListener("toolchange"), Promise.allSettled per-tool not Promise.all, allow="tools" iframe respects exposedTo/fromOrigins default same-origin, executeTool object-based + DOMString + AbortSignal, patientId correct not patient-s-devi; challenger SecureContext insecure fallback not crash, Permissions-Policy disabled NotAllowedError graceful, toolchange ordering non-deterministic, signal abort; auditor rebuilds + regreps toolchange >=1 + isSecureContext + allSettled + re-captures + 6 viewports
- M3 UI Surfaces & Regression (R1,R5): critic checks R1 native 40 via await getTools() length 40 in jsdom fallback polyfill parity + Chrome flag, Inspector label Native vs Polyfill accurate, Connect modal document.modelContext examples only, no regression lint 0 test 172 runner 231 build 1660 Flows A-E 1 PASS each, 6-viewport 320/375/768/1024/1280/1440 no gaps, vault empty gate; challenger real FileReader drop, approval gates pendingApprovalId, long names, cross-origin iframe allow absent 0; auditor full lint/test/build/runner + grep + screenshot audit + native probe log + 6 viewports + orphan-free vault fact visible
- Gates track in GATE_STATUS.md per milestone critic|challenger|auditor PASS/FAIL with evidence paths + logs /tmp/*.log
- Success Auditor final: independent lint/test/build/grep (registerTool delegation, inputSchema, toolchange, legacy globals 0, isSecureContext, permissionsPolicy, allSettled, AbortController) + live dev-server probe await getTools()->40 JSON.parse inputSchema + executeTool object DOMString patientId correct + toolchange >=1 + 6-viewport screenshots >=2 per milestone desktop1280+mobile375+tablet768 under .teamwork/snapshots/webmcp-*/ JFIF >5K + verification logs webmcp-native-probe.log webmcp-validation.log toolchange.log + 40 tools hidden wrappers 8 Flows A-E — must PASS before Sentinel Done

## Affected Files (test infra)

- package.json, vite.config.ts, tailwind.config.js, tsconfig.json, test/test-runner.ts, test/setup.ts, test/unit/WebMCPEngine.test.ts, test/tier3-integration/*, src/core/webmcp/WebMCPEngine.ts, src/types/webmcp.ts, src/tools/index.ts + 7 modules, src/main.tsx, src/components/common/WebMCPInspector.tsx + ConnectWebMCPModal.tsx, src/core/vault/LocalVault.ts, src/core/events/eventBus.ts, verification logs, snapshots
