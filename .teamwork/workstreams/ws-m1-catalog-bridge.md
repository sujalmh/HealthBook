# Workstream ws-m1-catalog-bridge

Role: worker_catalog_bridge
Milestone: milestone-01
Isolation: .teamwork/worktrees/ws-m1-catalog-bridge/
Files: src/tools/index.ts, src/tools/vaultTools.ts, src/tools/labStoryTools.ts, src/tools/pillMapTools.ts, src/tools/rxBridgeTools.ts, src/tools/homeLabTools.ts, src/tools/safetyTools.ts, src/tools/careCircleTools.ts
Status: pending
Owner: worker_catalog_bridge
DependsOn: []

## Scope
Owns catalog bridging 40 tools snake_case keep, parameters stays but adapter converts to inputSchema stringified + title/annotations readOnlyHint from requiresHumanApproval, no rename, approval gates staged pendingApprovalId, 3+2+8+5+5+9+8 =40 intact.

## Acceptance
40 tools intact, inputSchema via adapter stringified valid JSON Schema type object, annotations readOnlyHint mapped, lint 0 test 172 build 1660, vault FactStream still creates pending fact for correct patientId after FileReader drop
