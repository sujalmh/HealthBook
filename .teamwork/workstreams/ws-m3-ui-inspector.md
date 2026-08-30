# Workstream ws-m3-ui-inspector

Role: worker_ui_inspector
Milestone: milestone-03
Isolation: .teamwork/worktrees/ws-m3-ui-inspector/
Files: src/components/common/WebMCPInspector.tsx, src/components/common/ConnectWebMCPModal.tsx
Status: pending
Owner: worker_ui_inspector
DependsOn: ["milestone-02"]

## Scope
Owns UI surfaces. Replace window.modelContext etc with document.modelContext only, examples spec-correct Promise getTools + executeTool(object), Inspector refreshData tries native getTools Promise first then fallback, label Native vs Polyfill accurate based on actual document.modelContext presence, listens native toolchange, 6-viewport no gaps
