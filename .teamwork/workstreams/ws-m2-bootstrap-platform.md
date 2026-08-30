# Workstream ws-m2-bootstrap-platform

Role: worker_bootstrap_platform
Milestone: milestone-02
Isolation: .teamwork/worktrees/ws-m2-bootstrap-platform/
Files: src/main.tsx
Status: pending
Owner: worker_bootstrap_platform
DependsOn: ["milestone-01"]

## Scope
Owns bootstrap only. SecureContext guard isSecureContext + permissionsPolicy.allowsFeature('tools') try/catch NotAllowedError/SecurityError graceful fallback never crash, async after localVault.init before mount, Promise.allSettled per-tool not Promise.all, AbortController per-tool dedup for HMR/unmount
