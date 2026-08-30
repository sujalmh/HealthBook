# Milestone M2 — Bootstrap Secure & Platform Events (R4+R3)

**ID:** milestone-02
**DependsOn:** ["milestone-01"]
**Status:** pending
**Workstreams:** ws-m2-bootstrap-platform (worker_bootstrap_platform) — single

## Objective
Bootstrap correct lifecycle after localVault.init before mount with SecureContext+PermissionsPolicy guard, async Promise.allSettled per-tool, AbortController dedup, toolchange events, allow tools.

## Scope & Files
- ws-m2-bootstrap-platform: `src/main.tsx:9-67,83` — owns bootstrap only, async guard, Promise.allSettled, SecureContext, PermissionsPolicy, AbortController, toolchange

## Acceptance
- R4 DONE: isSecureContext + Permissions-Policy tools respected (try/catch NotAllowedError/SecurityError graceful fallback never crash), toolchange fires on register/unregister via document.modelContext.addEventListener("toolchange"), allow="tools" iframe respects exposedTo/fromOrigins default same-origin — logs toolchange.log; grep toolchange >=1, isSecureContext >=1, Promise.allSettled >=1, AbortController >=1
- R3 patientId still correct visible at 1280/375/768 after executeTool
- R1 fallback parity 40 via shim
- lint 0 test172 runner231 build1660 FlowsA-E
- Screenshots desktop1280+mobile375+tablet768 under .teamwork/snapshots/webmcp-m2/ JFIF >5K

## Verification Gate
critic→challenger→auditor batched — verify SecureContext insecure fallback not crash, PermissionsPolicy disabled graceful, toolchange >=1, allSettled not all, signal abort

## Ownership
- ws-m2-bootstrap-platform: ["src/main.tsx"] → .teamwork/worktrees/ws-m2-bootstrap-platform/
