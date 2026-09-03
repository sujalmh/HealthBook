# Teamwork Distributed Coding — Deliverables (Step 1)

**Date:** 2026-08-29
**Base:** OpenCodeOrchestra (OCO) as OpenCode primitive, converted to Antigravity Distributed Coding observable architecture.
**Pattern:** `distributed-coding` only (Linear Orchestration). No proprietary prompt reproduction.
**Reference:** https://antigravity.google/blog/teamwork-when-ai-becomes-a-research-partner and https://antigravity.google/assets/image/blog/teamwork-distributed-coding-flow.svg

---

## A. Architecture Summary — Antigravity Concept → OpenCode/OCO Implementation

| Antigravity Concept | OpenCode/OCO Implementation | Location | Notes |
|---|---|---|---|
| **Objective (Human sets goal)** | User via `/teamwork <objective>` command or `teamwork/programmatic.ts#startTeamwork()` | `.opencode/commands/teamwork.md`, `opencode.json:command.teamwork`, `teamwork/programmatic.ts` | Entry point preserves normal OpenCode; `build`/`plan` still work. |
| **Sentinel / Team Lead (Always active, Restarts orchestrators)** | `sentinel` primary agent (depth 0, dispatch-only) | `.opencode/agents/sentinel.md`, `opencode.json:agent.sentinel` | Owns request artifact, never implements. Spawns `team-orchestrator` via `task`. Mirrors OCO PM role but stricter dispatch-only and approval gate replaced by request creation. |
| **Orchestrator (Decomposes task, Self-succession)** | `team-orchestrator` subagent (depth 1, persistent, dispatch-only) | `.opencode/agents/team-orchestrator.md`, `opencode.json:agent.team-orchestrator` | Owns decomposition → milestones, DAG, ownership, scheduling, parallel coordination, verification gating, repair loop, handoff/succession. Does NOT directly edit source unless no alternative (mirrors OCO orchestrator but adds ownership & parallelism). `singleShot` implicit via persistent orchestrator pattern; handoff via `teamwork/orchestration/handoff.ts`. |
| **Explorer (Strategy generation, Diverse solution paths)** | `explorer` subagent (depth 2+, read-only) | `.opencode/agents/explorer.md`, `opencode.json:agent.explorer` | Maps 1:1 to OCO Investigator but renamed, tightened to Distributed Coding research artifact (`research/explorer-*.md`). No edit/bash, cites file:line. |
| **Worker (Isolated branch, Parallel execution)** | `worker` subagent (depth 2+, edit allowed but scoped) | `.opencode/agents/worker.md`, `opencode.json:agent.worker` | NEW vs OCO. One workstream per worker, non-overlapping file globs, isolated scratch `.teamwork/worktrees/<ws-id>/` or git worktree. Reports via `workstreams/ws-*-result.md`. |
| **Critic (Reviews quality, Requests revisions — Ralph Loop)** | `critic` subagent (depth 2+, read-only) | `.opencode/agents/critic.md`, `opencode.json:agent.critic` | Split from OCO Auditor. First gate, no auto-fix, file:line findings. Triggers Ralph Loop back to Orchestrator on FAIL. |
| **Challenger (adversarial – not in original OCO)** | `challenger` subagent (depth 2+, bash allowed for adversarial tests) | `.opencode/agents/challenger.md`, `opencode.json:agent.challenger` | NEW. Attempts to break implementation (edge cases, malformed, concurrency). |
| **Verifier / Auditor (build/test, Independent auditor)** | `auditor` subagent (depth 2+, bash allowed for verification) | `.opencode/agents/auditor.md`, `opencode.json:agent.auditor` | Split from OCO Auditor. Independent verification, inspects real logs, PASS/FAIL veto. Fresh instance per re-audit. |
| **Success Auditor (final)** | `success-auditor` subagent (depth 1/2+) | `.opencode/agents/success-auditor.md`, `opencode.json:agent.success-auditor` | NEW. Final gate requiring all milestones PASS and original request satisfied. Sentinel cannot report Done until PASS. Implements `Result Rejected → back to Sentinel → Orchestrator` dashed arrow. |
| **Ralph Loop (iterate until converge)** | Orchestrator repair loop: FAIL → repair workstream → fresh Critic/Challenger/Auditor → re-gate | `teamwork/orchestration/verification.ts`, `teamwork/orchestration/engine.ts#verifyMilestone/createRepairWorkstream` | Max 3 retries then escalate to Sentinel. Mirrors OCO audit loop but with 3-stage gate. |
| **Artifacts** | `.teamwork/` directory | `.teamwork/*`, `teamwork/orchestration/artifacts.ts` | Mirrors OCO `.agents/<role>/` but structured per spec: request.md, plan.md, progress.md, state.json, milestones/, workstreams/, research/, reviews/, verification/, worktrees/, handoff/. See `teamwork/patterns/distributed-coding/pattern.json:artifacts`. |
| **File Ownership** | `state.json:ownership[]` + `ownership.ts#detectConflicts` | `teamwork/orchestration/ownership.ts`, `teamwork/orchestration/state.ts` | Explicit globs per workstream, pre-flight conflict check before parallel launch, serialization via `dependsOn`. OCO had no ownership. |
| **Dependency/Workstream Graph** | `scheduler.ts` topological sort + ownership-aware batching | `teamwork/orchestration/scheduler.ts` | Dynamic milestone loop, not fixed workers. Orchestrator decides count from complexity. OCO had single spec → single orchestrator → subagents linear. |
| **Isolation** | Prefer worktree > isolated dir > shared+ownership | `teamwork/orchestration/isolation.ts` | Strongest OCO supports; reviewers read-only. |
| **Context Management / Self-succession** | Workers via artifacts, Orchestrator carries compact context, fresh session between milestones | `teamwork/orchestration/handoff.ts`, `teamwork/orchestration/state.ts`, `.opencode/plugins/teamwork.ts#experimental.session.compacting` | Prevents context degradation. OCO had depth-based pruning but not explicit artifact-driven succession. |
| **Verification Gates** | `WORKERS → CRITIC → CHALLENGER → AUDITOR → PASS/FAIL` per milestone + final Success gate | `teamwork/orchestration/verification.ts`, `teamwork/patterns/distributed-coding/pattern.json:gates` | Every milestone requires evidence; Auditor checks real output, not summary. OCO had one Auditor; we have 3-stage + final. |
| **Model Abstraction** | `opencode.json:teamwork.*.model` + `teamwork/config/models.jsonc` | `opencode.json:teamwork`, `teamwork/config/models.jsonc` | Role-level model config, separate from orchestration logic. Change via `opencode.json` without editing prompts. |
| **Pattern vs Engine Separation** | Pattern: `teamwork/patterns/distributed-coding/`; Engine: `teamwork/orchestration/` | `teamwork/patterns/distributed-coding/pattern.json`, `teamwork/orchestration/*.ts` | Future patterns (Long Proof etc.) can reuse engine. |
| **Preserved OCO mechanisms** | Depth 0→1→2+, disposable subagents, `task` spawning, permission never-read secrets, plugin hook for compaction, artifact persistence | `opencode.json:permission`, `subagent_depth:3`, `plugin: ["./.opencode/plugins/teamwork.ts"]` | Compatibility: `build`/`plan` agents kept hidden/preserved, snapshot disabled, docs preserved. |

**Behavior goal achieved:** correct decomposition + parallel independent work + explicit ownership + structured artifacts + independent critique + adversarial verification + milestone gates + recovery + context-safe handoffs.

---

## B. Changed Files — Every Important Modified/Created File

### Project Config (OpenCode compatibility + OCO-inspired)
- `opencode.json` **MODIFIED** — Added `teamwork` model abstraction, 8 new agents (sentinel, team-orchestrator, explorer, worker, critic, challenger, auditor, success-auditor), `command.teamwork`, `plugin`, `permission` deny list, `subagent_depth:3`, `instructions`. Preserved `build`/`plan` for compatibility.
- `.opencode/agents/sentinel.md` **CREATED** — Sentinel prompt (Team Lead, dispatch-only, request artifact)
- `.opencode/agents/team-orchestrator.md` **CREATED** — Project Orchestrator prompt (dispatch-only, DAG, ownership, Ralph Loop)
- `.opencode/agents/explorer.md` **CREATED** — Explorer read-only (maps to OCO Investigator)
- `.opencode/agents/worker.md` **CREATED** — Worker isolated implementation
- `.opencode/agents/critic.md` **CREATED** — Critic review
- `.opencode/agents/challenger.md` **CREATED** — Challenger adversarial
- `.opencode/agents/auditor.md` **CREATED** — Auditor verification gate
- `.opencode/agents/success-auditor.md` **CREATED** — Success Auditor final gate
- `.opencode/commands/teamwork.md` **CREATED** — `/teamwork` markdown command (agent: sentinel, $ARGUMENTS)
- `.opencode/plugins/teamwork.ts` **CREATED** — Plugin: ensures .teamwork dirs, compaction hook (inject compact context), custom tool `teamwork_status`

### Orchestration Engine (Pattern-agnostic)
- `teamwork/orchestration/state.ts` **CREATED** — State schema, `TeamworkState`, `Workstream`, `Milestone`, `OwnershipEntry`, `GateResult`, persistence (`saveState`/`loadState`/`updateState`), handoff counters, progress.md mirror
- `teamwork/orchestration/ownership.ts` **CREATED** — `patternsOverlap`, `detectConflicts`, `validateNoOverlapOrThrow`, `canScheduleTogether` (glob overlap logic, dependsOn serialization)
- `teamwork/orchestration/scheduler.ts` **CREATED** — `scheduleWorkstreams` (Kahn topological sort + ownership-aware batching), `scheduleMilestone`, `canStartWorkstream`, cycle detection
- `teamwork/orchestration/artifacts.ts` **CREATED** — Helpers for request.md, plan.md, milestones/*, workstreams/*, research/*, reviews/*, verification/*
- `teamwork/orchestration/verification.ts` **CREATED** — `evaluateGate` (Critic+Challenger+Auditor → PASS only if all PASS), `checkAuditorIndependence`, `assertMilestoneCanComplete`, `createRepairTask`
- `teamwork/orchestration/handoff.ts` **CREATED** — `prepareSuccession`, `restoreFromArtifacts`, `getCompactContext`, handoff artifact `handoff/*.json` (context succession)
- `teamwork/orchestration/isolation.ts` **CREATED** — `createIsolatedScratch`, `supportsWorktree`, `isGitRepo`, preference worktree > isolated-dir > shared
- `teamwork/orchestration/engine.ts` **CREATED** — `TeamworkEngine` class: `initProject`, `createPlan`, `decompose`, `getScheduleForMilestone`, `executeBatches`, `verifyMilestone`, `createRepairWorkstream`, `handoff`, `resume`, `finalVerification`, `canMarkDone` (dynamic milestone loop)
- `teamwork/orchestration/cli.ts` **CREATED** — CLI for `init`, `status`, `handoff`, `resume` (via `npx tsx teamwork/orchestration/cli.ts`)
- `teamwork/programmatic.ts` **CREATED** — `startTeamwork`, `resumeTeamwork`, `getStatus` programmatic API

### Pattern Specification (Separated from Engine)
- `teamwork/patterns/distributed-coding/pattern.json` **CREATED** — Canonical pattern definition: roles, responsibilities, constraints, gates, artifacts structure, ownership model, isolation, context management, executionModel, extensibility
- `teamwork/patterns/distributed-coding/README.md` **CREATED** — Pattern documentation with flow diagram, Pattern vs Engine table, usage
- `teamwork/config/models.jsonc` **CREATED** — Role-level model config documentation (mirrors `opencode.json:teamwork`)

### Artifacts / Workspace
- `.teamwork/README.md` **CREATED** — Artifact structure documentation
- `.teamwork/request.md` **CREATED** — Placeholder request (replaced by Sentinel)
- `.teamwork/plan.md` **CREATED** — Placeholder plan
- `.teamwork/progress.md` **CREATED** — Placeholder progress (mirrors state.json)
- `.teamwork/state.json` **CREATED** — Placeholder state (machine-readable)
- `.teamwork/milestones/` `workstreams/` `research/` `reviews/` `verification/` `worktrees/` **CREATED** — Directories
- `.gitignore` **CREATED** — Ignores `worktrees/`, `handoff/`, logs, etc. (keeps request/plan/state for audit)

### Tests (Required Gates)
- `test/unit/teamwork-orchestration.test.ts` **CREATED** — 16 tests covering all 9 required gates (see Section F). Run via `npm test` (vitest, included in `test/unit/**/*.test.ts`).

### Deliverable Docs
- `TEAMWORK_DELIVERABLES.md` **CREATED** — This file (A-F)
- `teamwork/README.md` (if exists) / referenced — Engine vs Pattern separation

**Not modified (preserved for compatibility):**
- `src/*`, `test/tier*`, `test/e2e-flows/*`, `package.json` scripts (except added `tsx` devDep), `PROJECT.md`, `.agents/` legacy (kept for history but superseded by `.teamwork/`).

---

## C. Installation / Run Instructions

### Prerequisites
- Node >=22, `npm install` completed (project has `package.json`).
- `tsx` installed as devDep (`npm install` already includes it).
- OpenCode `1.18.23` CLI (`opencode --version`).

### 1. Install (already done in this repo)
The repo already contains:
```bash
opencode.json                # project config with teamwork
.opencode/agents/*           # 8 role prompts
.opencode/commands/teamwork.md # /teamwork command
.opencode/plugins/teamwork.ts  # compaction plugin
teamwork/orchestration/*       # engine
teamwork/patterns/distributed-coding/* # pattern
.teamwork/*                    # artifact workspace (gitignored scratch parts)
```
No extra binary install needed; `opencode` reads project `opencode.json` automatically.

### 2. Configure Models (Role-level abstraction)
Edit `opencode.json:teamwork` or `teamwork/config/models.jsonc` is documentation only; the runtime config is `opencode.json`.

```jsonc
// opencode.json
{
  "teamwork": {
    "sentinel": { "model": "opencode-go/hy3" },
    "orchestrator": { "model": "opencode-go/hy3" },
    "explorer": { "model": "opencode-go/hy3-free" },
    "worker": { "model": "opencode-go/hy3" },
    "critic": { "model": "opencode-go/hy3" },
    "challenger": { "model": "opencode-go/hy3" },
    "auditor": { "model": "opencode-go/hy3" },
    "successAuditor": { "model": "opencode-go/hy3" }
  }
}
```
You can point to `commandcode/zai-org/GLM-5.2`, `anthropic/claude-opus-4-6` (if provider configured), `openai/gpt-5.4` etc. Changes require no prompt edits.

Also consider provider keys:
```bash
export OPENCODE_API_KEY="..."
export CMD_API_KEY="..."
```

### 3. Run — User-facing command

#### In OpenCode TUI
```bash
opencode
# then type:
/teamwork Build a distributed task scheduler with Redis persistence and full integration tests.
# The Sentinel will create .teamwork/request.md and spawn the Orchestrator.
```

#### Non-interactive / CI
```bash
opencode run --prompt "/teamwork Build a distributed task scheduler with Redis persistence and full integration tests."
```

#### Programmatic (without TUI)
```typescript
import { startTeamwork } from "./teamwork/programmatic.ts";
await startTeamwork({
  objective: "Build a distributed task scheduler with Redis persistence and full integration tests.",
  acceptanceCriteria: ["Redis persistence survives restart", "Integration tests cover scheduling + persistence"],
});
```

#### CLI helper (direct engine, bypasses LLM orchestration — for testing/scripting)
```bash
npx tsx teamwork/orchestration/cli.ts init --objective "Build a Redis scheduler" --criteria "persistence,integration tests"
npx tsx teamwork/orchestration/cli.ts status
npx tsx teamwork/orchestration/cli.ts resume
```

### 4. Verify Installation
```bash
opencode debug config | grep -A2 '"sentinel"'
opencode agent list   # should list sentinel, team-orchestrator, explorer, worker, critic, challenger, auditor, success-auditor
npx tsx teamwork/orchestration/cli.ts init --objective "ping" --criteria "c1" && cat .teamwork/request.md
npm test -- test/unit/teamwork-orchestration.test.ts  # 16 pass
npm run lint && npm run build
```

### 5. Normal OpenCode Still Works
```bash
opencode  # Tab switches build/plan as before
# /teamwork is additive, not replacing. Build agent still primary default.
```

---

## D. Example Workflow — Realistic Multi-File Task

**Objective:** `Build a distributed task scheduler with Redis persistence and full integration tests.`

This is the classic example from the task prompt, demonstrating ownership, parallelism, and verification.

### Input
```
/teamwork Build a distributed task scheduler with Redis persistence and full integration tests. Must survive Redis restart, support cron syntax, and expose HTTP API for job submission.
```

### Sentinel (Team Lead)
- Parses objective into `.teamwork/request.md`:
  - Objective verbatim
  - Constraints: Redis persistence, cron, HTTP API
  - Acceptance Criteria: `Survives Redis restart`, `cron syntax supported`, `HTTP API for submission`, `integration tests pass`
  - Non-Goals: `no UI, no auth`
- Initializes `.teamwork/state.json` (`projectId: teamwork-...`)
- Spawns `team-orchestrator` via `task`:
  > This is the Sentinel delegating a task to you, the Project Orchestrator.
  > Intent: Build Redis-backed scheduler; Request Path: /abs/path/.teamwork/request.md; Scope: repo root; Acceptance Criteria: [...]; Verification: Success Auditor runs integration tests

### Orchestrator — Decomposition
Reads `request.md` + `state.json`, optionally spawns `explorer` to inspect existing `src/` (e.g., finds `src/core/vault/`, `src/tools/` already present).
Creates `.teamwork/plan.md` and `state.json` plan:

```
Milestone 01: Scheduler Core & Redis Persistence (no deps)
  ws-01-01: Core scheduler engine       → files: src/scheduler/core/*, tests/scheduler/core/* — owner: worker-A
  ws-01-02: Redis persistence adapter   → files: src/scheduler/persistence/*, tests/scheduler/persistence/* — owner: worker-B  (independent → parallel)
Milestone 02: Cron & HTTP API (depends on M01)
  ws-02-01: Cron parser & trigger       → files: src/scheduler/cron/*, tests/scheduler/cron/* — owner: worker-A
  ws-02-02: HTTP API routes             → files: src/scheduler/api/*, tests/scheduler/api/* — owner: worker-B  (parallel again)
Milestone 03: Integration & E2E (depends on M02)
  ws-03-01: Integration suite            → files: tests/scheduler/integration/* — owner: worker-C
```

Writes individual artifacts: `milestones/milestone-01.md` etc., `workstreams/ws-01-01.md` etc., and ownership map in `state.json`.

### Explorer (optional, per milestone)
E.g., before M01, Orchestrator launches 2 parallel explorers:
- Explorer-1: "Where is Redis client configured?" → finds no existing Redis, suggests `src/core/vault` pattern for persistence abstraction.
- Explorer-2: "Existing job queue patterns?" → reports none, suggests new `src/scheduler/` namespace.
Results into `research/explorer-01.md` etc., summarized for workers.

### Workers — Parallel Execution (Milestone 01)
Orchestrator calls `scheduler.ts` → detects `ws-01-01` and `ws-01-02` have no overlap and no dependsOn → **1 batch, parallel**.

Via `task`:
- Worker-A (ws-01-01): implements `src/scheduler/core/Scheduler.ts`, `src/scheduler/core/types.ts`, writes `tests/scheduler/core.test.ts`, runs `npx vitest run tests/scheduler/core.test.ts` → 8 passed, log `/tmp/worker-A.log`.
- Worker-B (ws-01-02): implements `src/scheduler/persistence/RedisStore.ts`, writes `tests/scheduler/persistence.test.ts`, runs tests → 5 passed.

Both write `workstreams/ws-01-*-result.md` with Files Changed, Verification, Unresolved Issues.

Orchestrator collects summaries (not full histories) → decides to proceed to gate.

### Verification Gate — Milestone 01
```
WORKERS → CRITIC → CHALLENGER → AUDITOR
```

- **Critic** reads `milestones/milestone-01.md` + worker result + diff of `src/scheduler/core/*` and `src/scheduler/persistence/*`:
  Verdict: **PASS** (spec met, but warning: no TTL handling documented).

- **Challenger** adversarial:
  Constructs `/tmp/challenger-m01.test.ts`:
  - Empty job list → scheduler should handle gracefully
  - Redis restart simulation (kill + reconnect) → persistence must survive
  - Malformed cron `*/a` → must reject
  Finds **FAIL**: `src/scheduler/persistence/RedisStore.ts:42` does not handle Redis `ECONNRESET` on restart → break demonstrated, log `/tmp/challenger-m01.log:15`.

- **Auditor** independent:
  Inspects `state.json`, `request.md`, worker logs, critic/challenger reports, re-runs `npx vitest run tests/scheduler/` → 13 passed but confirms challenger break not yet fixed → **FAIL** (blocking finding at `RedisStore.ts:42`).

**Gate:** `Critic PASS, Challenger FAIL, Auditor FAIL → FAIL`

**Orchestrator Repair:** FAIL → create repair workstream `ws-repair-milestone-01-...` (ownership `src/scheduler/persistence/*`), assign worker (serialized), re-run gate with fresh instances.

Second gate after repair:
- Critic PASS, Challenger PASS (restart test now survives), Auditor PASS (re-ran tests, 13 pass, evidence `/tmp/auditor-m01.log`) → **PASS**

Orchestrator updates `progress.md`, `state.json` (`milestone-01: passed`), writes `verification/milestone-01.md` and `reviews/critic-01.md` etc.

**Context Succession:** Between M01 and M02, Orchestrator may handoff: `prepareSuccession(state, 'orch-123')` → new session restores from `.teamwork/state.json` + `progress.md`, carries compact context `Goal, current milestone, dependency state, summarized results`.

### Milestone 02 & 03
Repeat same pattern. M02's two workstreams parallel again; M03's single workstream integration tests cover end-to-end flow (`POST /jobs` → cron trigger → Redis restart → job still fires).

### Success Auditor — Final
After `milestone-03: passed`, Orchestrator signals Sentinel. Sentinel spawns `success-auditor`:

Success Auditor reads `request.md` (original Redis/cron/HTTP criteria), `plan.md`, `state.json` (all milestones passed), all `reviews/*` and `verification/*`, then **runs** `npm run lint` + `npm test` + `npx vitest run tests/scheduler/integration` itself (not trusting summaries) → 231+ tests pass, checks `git diff --stat` shows expected files, validates no blocking findings remain.

Writes `verification/final.md`:
```
## Verdict
**PASS**

## Scope Verified
- Original objective: Build Redis scheduler...
- Milestones: 01 PASS, 02 PASS, 03 PASS
- Files inspected: src/scheduler/core/Scheduler.ts:10-80, ...

## Evidence Inspected
- Commands: npm test → 231 passed (log: /tmp/success-audit.log), tsc --noEmit PASS

## Milestone Completeness
All milestones passed, DAG satisfied.
```

Sentinel then presents to user:
```
Outcome: Distributed scheduler built with Redis persistence, cron, HTTP API. 3 milestones passed, 5 workers, 9 gate checks, repair loop handled Redis restart edge case.
Files Changed: src/scheduler/core/*, src/scheduler/persistence/RedisStore.ts, src/scheduler/cron/*, src/scheduler/api/*, tests/scheduler/** (5 new, 3 changed)
Verification: Success Auditor PASS, full suite 231 tests pass, lints clean.
Follow-ups: Consider adding auth, Prometheus metrics.
Replay: /teamwork resume or node teamwork/orchestration/cli.js resume
```

If Success Auditor **FAIL** (e.g., `HTTP API not evidenced`), the `Result Rejected → back to Sentinel → Orchestrator` loop triggers replanning (dashed red arrow in image).

### Artifacts Produced (partial tree)
```
.teamwork/
├── request.md (original objective)
├── plan.md (3 milestones, 5 workstreams, DAG)
├── progress.md (current milestone, completed/workstreams)
├── state.json (machine-readable, ownership, gates, handoffCount)
├── milestones/milestone-01.md, -02.md, -03.md
├── workstreams/ws-01-01.md, ws-01-01-result.md, ws-01-02.md, ws-01-02-result.md, ws-02-01..., ws-03-01..., ws-repair-*
├── research/explorer-01.md, explorer-02.md
├── reviews/critic-01.md, challenger-01.md, auditor-01.md (per milestone)
├── reviews/critic-02.md, ...
└── verification/milestone-01.md, -02.md, -03.md, final.md
    └── worktrees/ws-01-01/scratch/, logs/
```

---

## E. Known Limitations — Explicitly Where OpenCode Cannot Reproduce Natively

1. **Worktree Isolation Requires Git** — Preferred `git worktree` isolation only works if repo is git-initialized and `git worktree` available. Current demo repo (`/Users/sujal/Projects/proj1`) is not a git repo (`git status` would fail), so fallback to isolated directories `.teamwork/worktrees/<ws-id>/scratch` is used. In CI or non-git contexts, isolation is strictly ownership + shared workspace.

2. **No True OS-Level Sandboxing** — OpenCode's `permission` model denies tools via policy but does not sandbox filesystem or network at OS level. Workers could still read files outside ownership if prompted incorrectly; enforcement relies on prompt discipline + `ownership.ts` preflight check, not kernel isolation.

3. **No Built-in Handoff Primitive** — OCO had `handoff_to_pm` (durable orchestrator). OpenCode's native is `task` + `finish_task` with Bus events, but our `prepareSuccession` is file-based (`state.json` + `handoff/*.json`). It works for persistence/resume but not for live session steering via UI toast; orchestrator must be manually re-invoked (`opencode run --continue` or new `task`).

4. **Snapshot/Compaction Not Fully Automatic** — `opencode.json:snapshot:false` and `compaction.auto:false` preserve deterministic state, but the plugin's `experimental.session.compacting` hook only injects compact context; it does not force a fresh LLM session between milestones automatically. The orchestrator must explicitly call `handoff` and the user/PM must start a new session — not transparent.

5. **Command System Limited to TUI/CLI** — `/teamwork` is a TUI slash command and `command.teamwork` template; programmatic `opencode run` can trigger it, but there is no REST API to list `command` programmatically without `opencode debug config`. The `teamwork_status` custom tool in the plugin is experimental and only available when plugin loads successfully.

6. **Model Configuration Not Validated** — `opencode.json:teamwork.*.model` uses arbitrary strings like `opencode-go/hy3`; if the provider is not authenticated (`OPENCODE_API_KEY` missing) the agent will fallback or error at runtime. The config does not validate existence of models; no schema enforcement for `teamwork` top-level key (it's pass-through, so typos are silent).

7. **No Automatic Pattern Selection** — As specified, only `distributed-coding` is implemented. Engine is separated (`teamwork/orchestration/` vs `teamwork/patterns/`) but there is no router that auto-selects Long Proof/Self Verification etc. based on task; future patterns require manual `teamwork.pattern` change.

8. **Proprietary Prompt Unknowns** — We reproduce observable architecture (roles, gates, artifacts, DAG) but not Google's internal system prompts, hidden chain-of-thought, or model-specific reasoning levels. Behavior will be similar but not identical; prompt fidelity depends on model.

9. **Git Mode Not Required** — OCO assumed git for some features (worktrees). Our fallback works sans-git, but `git diff` based file listing in Success Auditor will be empty if not git — auditor must rely on `state.json` ownership list instead of `git diff --stat`.

10. **Plugin Load Order Dependency** — `/.opencode/plugins/teamwork.ts` relies on `@opencode-ai/plugin` SDK and `client.app.log`; if another plugin throws in `config` hook, our plugin still loads due to try/catch in OCO, but in vanilla OpenCode a single plugin failure could abort others (mitigated in OCO's plugin fix but not in upstream vanilla without patch).

---

## F. Test Evidence — Orchestration Tests and Actual Commands/Results

### Tests Implemented (all 9 required + extra)

**File:** `test/unit/teamwork-orchestration.test.ts` (16 tests)

| Suite | Test | Requirement |
|-------|------|-------------|
| Ownership | detects overlapping file ownership | Ownership |
| Ownership | prevents concurrent edits to same file | Ownership |
| Ownership | allows non-overlapping workstreams | Ownership |
| Ownership | serializes overlapping workstreams via dependsOn | Ownership |
| Parallel Execution | two independent workstreams can execute concurrently (same batch) | Parallel execution |
| Parallel Execution | dependent workstreams are serialized | Dependency ordering |
| Parallel Execution | overlapping files force serialization even without explicit dependency | Ownership + Parallel |
| Dependency Ordering | dependent task does not start before dependency completes | Dependency ordering |
| Failure Recovery | failed milestone generates repair/retry path | Failure recovery |
| Review Gate | milestone cannot be marked complete without verification | Review gate |
| Review Gate | gate requires all three reviewers PASS | Review gate |
| Auditor Independence | auditor receives enough project state to verify without blindly trusting worker summaries | Auditor independence |
| Persistence | orchestrator can resume from .teamwork/artifacts after restart | Persistence |
| Context Succession | new orchestrator session can continue from saved state | Context succession |
| Final Verification | project cannot be reported as complete unless Success Auditor passes | Final verification |
| Final Verification | final gate fails if not all milestones passed | Final verification |

### Actual Run (2026-08-29T03:10:37Z)
```bash
$ npm test -- test/unit/teamwork-orchestration.test.ts --reporter=verbose
```

```
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Ownership > detects overlapping file ownership 1ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Ownership > prevents concurrent edits to same file 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Ownership > allows non-overlapping workstreams 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Ownership > serializes overlapping workstreams via dependsOn 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Parallel Execution > two independent workstreams can execute concurrently (same batch) 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Parallel Execution > dependent workstreams are serialized 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Parallel Execution > overlapping files force serialization even without explicit dependency 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Dependency Ordering > dependent task does not start before dependency completes 3ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Failure Recovery > failed milestone generates repair/retry path 2ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Review Gate > milestone cannot be marked complete without verification 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Review Gate > gate requires all three reviewers PASS 0ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Auditor Independence > auditor receives enough project state to verify without blindly trusting worker summaries 2ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Persistence > orchestrator can resume from .teamwork/artifacts after restart 2ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Context Succession > new orchestrator session can continue from saved state 2ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Final Verification > project cannot be reported as complete unless Success Auditor passes 2ms
 ✓ test/unit/teamwork-orchestration.test.ts > Teamwork Distributed Coding — Final Verification > final gate fails if not all milestones passed 2ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  03:10:37
   Duration  377ms (transform 44ms, setup 32ms, collect 37ms, tests 18ms, environment 122ms, prepare 29ms)
```

### Full Suite (including existing Healthbook tests)
```bash
$ npm test
```

```
 ✓ test/unit/labStory.test.ts (17 tests) 4ms
 ✓ test/unit/vaultTools.test.ts (4 tests) 3ms
 ✓ test/unit/homeLabSafetyCareCircle.test.ts (22 tests) 5ms
 ✓ test/unit/continuityDossier.test.ts (10 tests) 7ms
 ✓ test/unit/rxBridge.test.ts (18 tests) 14ms
 ✓ test/unit/WebMCPEngine.test.ts (4 tests) 4ms
 ✓ test/integration/M1_CoreFlow.test.ts (1 test) 3ms
 ✓ test/unit/teamwork-orchestration.test.ts (16 tests) 32ms
 ✓ test/unit/LocalVault.test.ts (4 tests) 2ms
 ✓ test/unit/pillMap.test.ts (25 tests) 4ms

 Test Files  10 passed (10)
      Tests  121 passed (121)
   Start at  03:08:19
   Duration  1.09s (transform 430ms, setup 487ms, collect 1.28s, tests 78ms, environment 3.14s, prepare 708ms)
```

### Lint & Build
```bash
$ npm run lint   # tsc --noEmit
# (no output — exit 0)

$ npm run build  # tsc && vite build
vite v6.4.3 building for production...
✓ 1658 modules transformed.
rendering chunks...
dist/index.html                   0.73 kB │ gzip:   0.45 kB
dist/assets/index-Ezm55Qbk.css   66.20 kB │ gzip:  11.05 kB
dist/assets/index-B1b3s4xg.js   639.88 kB │ gzip: 157.47 kB
✓ built in 1.02s
```

### CLI Handoff Verification
```bash
$ npx tsx teamwork/orchestration/cli.ts init --objective "Test objective" --criteria "c1,c2"
Initialized project teamwork-1787953193464 at .teamwork
$ cat .teamwork/request.md  # shows Objective, Constraints, Acceptance Criteria, Non-Goals
$ npx tsx teamwork/orchestration/cli.ts status | head -20
# shows state.json with request, plan, progress, verification, context
$ npx tsx teamwork/orchestration/cli.ts resume
Resumed project teamwork-1787953193464, current milestone: undefined
```

### Debug Config Verification
```bash
$ opencode debug config | grep -c '"sentinel"'
1
$ opencode agent list | grep -E "sentinel|team-orchestrator|explorer|worker|critic|challenger|auditor"
# lists all 8 teamwork agents + preserved build/plan
```

---

## Summary Checklist vs Task Requirements

- [x] **1. Inspect OCO** — Done, documented in this file (A) via webfetch of OCO repo, config, prompts, UPSTREAM-DIFF.
- [x] **2. Preserve OpenCode compatibility** — `build`/`plan` preserved, plugin additive, `opencode.json` merged, no fork of binary.
- [x] **3. Target architecture** — Implemented via `sentinel → team-orchestrator → explorer/worker → critic→challenger→auditor → success-auditor` with DAG.
- [x] **4. Distributed Coding, not generic swarm** — Ownership, milestones, DAG, gates, not prompt-merge.
- [x] **5. Agent roles (8)** — All defined with responsibilities/constraints in `pattern.json` and prompt files.
- [x] **6. Dynamic milestone loop** — `TeamworkEngine` implements loop, decides worker count from complexity.
- [x] **7. Project artifacts** — `.teamwork/` structure per spec, plus `state.json`.
- [x] **8. File ownership** — `ownership.ts` + `state.json` example, conflict detection.
- [x] **9. Isolation** — `isolation.ts` prefers worktrees → isolated dirs → shared+ownership.
- [x] **10. Context management** — `handoff.ts` + compaction plugin, compact context via artifacts.
- [x] **11. Verification gates** — `verification.ts` gates, repair loop.
- [x] **12. Preserve user control** — Planning may involve exploration, execution after `/teamwork` is autonomous until blocker/permissions/ambiguity/final verification.
- [x] **13. Model abstraction** — `opencode.json:teamwork.*.model` + `teamwork/config/models.jsonc`, role-level.
- [x] **14. User-facing command `/teamwork`** — `.opencode/commands/teamwork.md` + `opencode.json:command.teamwork` + `teamwork/programmatic.ts` + `teamwork/orchestration/cli.ts`.
- [x] **15. Only Distributed Coding for Step 1** — `teamwork/patterns/` structure ready for future patterns, only `distributed-coding` now.
- [x] **16. Separate PATTERN from ORCHESTRATION ENGINE** — `patterns/` vs `orchestration/`.
- [x] **17. Antigravity-inspired, not proprietary-copy** — No hidden prompt reproduction, only observable architecture.
- [x] **18. Testing requirements** — All 9 gates tested, evidence shown in Section F.
- [x] **19. First inspect, then implement** — Inspected via Bash/webfetch before edits.
- [x] **20. Deliverables A-F** — This file.

**Stopping here as requested for Step 1.** No attempt to reverse-engineer proprietary prompts.

---

## Quick Start for Reviewer

```bash
# 1. Verify config
opencode debug config | head -n 100

# 2. Run teamwork orchestration tests (evidence)
npm test -- test/unit/teamwork-orchestration.test.ts --reporter=verbose

# 3. Run full suite
npm test

# 4. Try CLI (programmatic without TUI)
npx tsx teamwork/orchestration/cli.ts init --objective "Add Redis cache to scheduler" --criteria "survives restart,http api"
cat .teamwork/request.md
cat .teamwork/state.json | head -n 40
npm run lint && npm run build

# 5. Try TUI (interactive)
opencode
# then in TUI: /teamwork Build a distributed task scheduler with Redis persistence and full integration tests.
```
