# Milestone M1 — Core Protocol Adapter & Dictionary (R2,R3 foundation)

**ID:** milestone-01
**DependsOn:** []
**Status:** pending
**Workstreams:** ws-m1-engine-core (worker_engine_core), ws-m1-catalog-bridge (worker_catalog_bridge) — parallel, no file overlap

## Objective
Make engine spec-correct dictionary & Promise lifecycle grounded in spec §4.1-4.3. Fix WebMCPEngine.ts + types to map parameters→inputSchema, validate name/description, handle duplicate via AbortController, implement Promise shapes, bridge patientId, toolchange shim.

## Scope & Files (partitioned)
- ws-m1-engine-core: `src/core/webmcp/WebMCPEngine.ts:14,22-25,27-66,68-75` + `src/types/webmcp.ts:34-45,47-60` + new `src/core/webmcp/WebMCPAdapter.ts` if created — owns engine core, types adapter, polyfill guard
- ws-m1-catalog-bridge: `src/tools/index.ts:69-123,127-136` + all 7 modules `vaultTools.ts, labStoryTools.ts, pillMapTools.ts, rxBridgeTools.ts, homeLabTools.ts, safetyTools.ts, careCircleTools.ts` — owns catalog bridging snake_case keep Q5, approval gates Q6
- Parallel safe: engine/types vs tools disjoint — ownership detectConflicts 0 PASS

## Acceptance
- R2 DONE: all 40 use inputSchema stringified, name regex ^[a-zA-Z0-9_.-]{1,128}$ PASS, empty name/description → InvalidStateError, duplicate → InvalidStateError, HMR not crash via AbortController — logs .teamwork/verification/webmcp-validation.log
- R3 API parity partial: getTools()→Promise<RegisteredTool[]> with origin/window, executeTool(toolObject,inputObject,{signal})→Promise<DOMString> stringified WebMCPToolResult, patientId correct via localStorage
- Grep: inputSchema >=1, toolchange >=1, polyfill guard if (document.modelContext?.registerTool) never overwrite, legacy globals 0 in prod except jsdom guarded
- lint 0, test 172+ PASS, build 1660±delta, Flows A-E PASS
- Screenshots ≥2 per workstream desktop1280+mobile375+tablet768 under .teamwork/snapshots/webmcp-m1/ JFIF >5K
- Ownership: ws-m1-engine-core DISJOINT ws-m1-catalog-bridge

## Verification Gate
critic→challenger→auditor batched N+M+1 single parallel call — verify name/description validation probes, Promise shapes, patientId not '', orphan-free, inputSchema JSON.parse, toolchange shim, build/test

## Ownership
- ws-m1-engine-core: ["src/core/webmcp/WebMCPEngine.ts", "src/types/webmcp.ts", "src/core/webmcp/WebMCPAdapter.ts"] → .teamwork/worktrees/ws-m1-engine-core/
- ws-m1-catalog-bridge: ["src/tools/index.ts", "src/tools/vaultTools.ts", "src/tools/labStoryTools.ts", "src/tools/pillMapTools.ts", "src/tools/rxBridgeTools.ts", "src/tools/homeLabTools.ts", "src/tools/safetyTools.ts", "src/tools/careCircleTools.ts"] → .teamwork/worktrees/ws-m1-catalog-bridge/
