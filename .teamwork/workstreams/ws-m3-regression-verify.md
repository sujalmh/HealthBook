# Workstream ws-m3-regression-verify

Role: worker_regression_verify
Milestone: milestone-03
Isolation: .teamwork/worktrees/ws-m3-regression-verify/
Files: test/unit/WebMCPEngine.test.ts, test/setup.ts, vite.config.ts, test/test-runner.ts
Status: pending
Owner: worker_regression_verify
DependsOn: ["milestone-02"]

## Scope
Owns test harness verification discipline + snapshot orchestration. Keep 172 vitest PASS +231 runner PASS, add native probe shim for jsdom fallback parity (await document.modelContext.getTools() length 40 JSON.parse inputSchema), ensure lint 0 build 1660 Flows A-E, 6-viewport screenshots orchestration, verification logs
