# Milestone M3 — UI Surfaces & Regression Verification (R1,R5)

**ID:** milestone-03
**DependsOn:** ["milestone-02"]
**Status:** pending
**Workstreams:** ws-m3-ui-inspector (worker_ui_inspector), ws-m3-regression-verify (worker_regression_verify) — parallel disjoint

## Objective
Fix UI to spec-correct: Inspector tries native getTools Promise first, label accurate, listens toolchange; Connect modal only document.modelContext; preserve 40, lint/test/build, 6-viewport, Flows A-E.

## Scope & Files
- ws-m3-ui-inspector: `src/components/common/WebMCPInspector.tsx:46,76-83,265-267` + `src/components/common/ConnectWebMCPModal.tsx:67-81` — owns UI surfaces
- ws-m3-regression-verify: `test/unit/WebMCPEngine.test.ts:13-35` + `test/setup.ts` + `vite.config.ts:34` + `test/test-runner.ts:38-132` — owns test harness verification discipline + snapshots orchestration — disjoint from UI (src/components/common vs test/*) parallel safe

## Acceptance
- R1 DONE Native 40: Chrome149 flag localhost isSecureContext true await getTools length40 JSON.parse inputSchema PASS + same 40 polyfill fallback jsdom — logs .teamwork/verification/webmcp-native-probe.log + screenshots 1280/375 under .teamwork/snapshots/webmcp-native/
- R2 Dictionary still PASS + R3 API parity final getTools Promise RegisteredTool with origin/window executeTool object DOMString patientId correct visible 1280/375/768 + R4 toolchange allow tools still PASS
- R5 No regression: npm run lint 0, npm test 172+ PASS, npx tsx test/test-runner.ts 231 PASS (Tier1 200 + Tier2+Tier3+Tier4+E2E FlowsA-E 1 PASS each), npm run build 1660±delta dist valid, 6-viewport 320/375/768/1024/1280/1440 no gaps, Inspector label Native vs Polyfill accurate, Connect modal spec-correct document.modelContext examples, prior grep ST. JUDE 0 stays 0 — grep gates all PASS
- Screenshots ≥2 per workstream desktop1280+mobile375+tablet768 under .teamwork/snapshots/webmcp-m3/ + native + invoke JFIF >5K

## Verification Gate
critic→challenger→auditor batched + Success Auditor final probe before Done — verify 40, inputSchema, toolchange, legacy globals 0, lint/test/build, 6-viewport, orphan-free

## Ownership
- ws-m3-ui-inspector: ["src/components/common/WebMCPInspector.tsx", "src/components/common/ConnectWebMCPModal.tsx"] → .teamwork/worktrees/ws-m3-ui-inspector/
- ws-m3-regression-verify: ["test/unit/WebMCPEngine.test.ts", "test/setup.ts", "vite.config.ts", "test/test-runner.ts"] → .teamwork/worktrees/ws-m3-regression-verify/
