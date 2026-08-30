# Research — Spec Miner Tests-Verification — 2026-08-30

Scope: tests & verification infra

## Findings file:line
- package.json:9 npm test vitest run, 10 test:all node test/test-runner.ts, 11-15 tier splits, 19 lint tsc --noEmit
- vite.config.ts:14-16 globals jsdom setupFiles test/setup.ts, 34 include tier3-integration, alias @→src 6-11
- test/setup.ts:1-3 jest-dom, guarded polyfill if !(document.modelContext?.registerTool) else new WebMCPEngine 6-19 clearAll
- test/test-runner.ts:39-46 argv filter, 55-75 runSuite duration, 78-87 Tier1 40 tools 200 tests, 90-93 T2 12, 96-99 T3 INT 12, 101-105 T4 workloads, 108-115 E2E A-E, 118-132 summary exit1
- test/unit/WebMCPEngine.test.ts:6-44 40 tools, 146-182 Promise getTools 40 inputSchema origin window, 184-230 toolchange executeTool DOMString probe-patient-001
- test/harness/webmcp-test-shim.ts:18-42 isolated vault/engine
- test/tier3-integration/cohesion.test.ts 28 cases, supabase.test.ts 8 cases
- .teamwork/TEST_INFRA.md:7-16 baseline 1660 modules 172/231 PASS lint0, 18-39 coverage guards ST.JUDE 0 40 tools inputSchema toolchange legacy0, 41-46 snapshot discipline >=2 per worker 1280/375/768 JFIF>5K 6 viewports 320-1440, 49-54 verification per milestone
- .teamwork/verification/grep-gates.log 6 isSecureContext, 6 permissionsPolicy, 12 allSettled, 22 AbortController, 33 toolchange, 39 inputSchema, 0 legacy, 7 registerTool delegation, ST.JUDE 0
- prompt.md:108 R1 env gate VITE_AI_ENABLED>=4 log env-config, 109 no-hardcode 0 deepseek/muse/zen, 110 configurable-read >=1, 111 bbox 0, 112 vision >=1, 113 structured >=1, 114 OCR 0, 123-131 R2 7 branch elimination logs, 132 cross-field probe CROSS_FIELD PASS log, 139-143 R3 VITE_AI >=1 .gitignore .env build1660 test172 runner231 getTools40, 146 Settings gate glob Settings* localStorage, 150-155 R4 artifacts existence git diff only .teamwork stat mtime

Counts: VITE_AI 81 total 0 in src green field, hardcode 100, verification 100+ hits

## Dependencies
vitest → vite.config jsdom → setup.ts polyfill → WebMCPEngine tests → runner harness isolated vault → grep-gates.log + build lint → browser.capture 6 viewports → snapshots → verification logs

## Affected Files
package.json, vite.config.ts, test/setup.ts, test/test-runner.ts, test/harness/**, test/unit/**/*.test.ts, test/tier3-integration/*.test.ts, .teamwork/verification/*.log, .teamwork/snapshots/**, .teamwork/logs/**, .teamwork/*.md, .teamwork/state.json, .teamwork/research/**

## Unknowns
No coverage threshold in vite.config, snapshot per-milestone minimal vs aggregated, Settings>env precedence not yet code, structured Zod mapping open

## Tool Discipline
glob grep read only, no bash
