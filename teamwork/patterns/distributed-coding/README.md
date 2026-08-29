# Distributed Coding Pattern — Teamwork

Antigravity-inspired Distributed Coding / Linear Orchestration.

> **Reference:** https://antigravity.google/blog/teamwork-when-ai-becomes-a-research-partner and flow image https://antigravity.google/assets/image/blog/teamwork-distributed-coding-flow.svg
>
> This pattern reproduces the **observable orchestration architecture, roles, control flow, artifacts, isolation, and verification behavior** — not Google's proprietary hidden prompts.

## Conceptual Flow

```
USER
  │
  ▼
SENTINEL / TEAM LEAD
  │ owns objective, creates request artifact, starts project
  ▼
PROJECT ORCHESTRATOR
  │ decomposes into milestones, builds DAG, assigns ownership, delegates all work
  │
  ├───────────────┬────────────────┬──────────────────┐
  ▼               ▼                ▼                  ▼
EXPLORER       WORKER A         WORKER B          WORKER C
(read only)   implementation   implementation    implementation
                 │                │                  │
                 └────────────────┼──────────────────┘
                                  ▼
                           MILESTONE RESULT
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                 CRITIC       CHALLENGER      AUDITOR
                 review       adversarial     verification
                    │             │             │
                    └─────────────┼─────────────┘
                                  ▼
                         MILESTONE GATE
                         ┌────────┴────────┐
                         │                 │
                       FAIL               PASS
                         │                 │
                         ▼                 ▼
                    REPLAN / FIX      NEXT MILESTONE
                                          │
                                          ▼
                                   SUCCESS AUDITOR
                                          │
                                          ▼
                                        DONE
```

Also see Fig image: `Objective → Sentinel (Always active, Restarts orchestrators) → Orchestrator (Decomposes task, Self-succession) → Explorer (Strategy generation, Diverse paths) → Worker (Isolated branch, Parallel) → Critic (Reviews quality, Requests revisions — Ralph Loop back to Orchestrator) → Verifier/Auditor (build/test, Independent) → Done`. Result Rejected → back to Sentinel → Orchestrator.

## Pattern vs Engine Separation

| Concern | Location |
|---------|----------|
| **Pattern** (roles, responsibilities, gates, allowed transitions, artifact requirements, verification requirements) | `teamwork/patterns/distributed-coding/pattern.json` + this README |
| **Orchestration Engine** (spawning, scheduling, state tracking, dependency management, ownership, retries, handoffs, persistence) | `teamwork/orchestration/` |

Add future patterns under `teamwork/patterns/<name>/` without rewriting engine.

## Roles

See `pattern.json` roles array for canonical definitions:

- Sentinel (Team Lead) — primary, owns objective
- Project Orchestrator — depth 1, dispatch-only, owns plan/state
- Explorer — read-only
- Worker — isolated, non-overlapping files
- Critic — review
- Challenger — adversarial
- Auditor — verification gate
- Success Auditor — final gate

## Gates

- **Milestone Gate:** `critic → challenger → auditor` all must PASS. FAIL → repair task → fresh reviewers.
- **Success Gate:** `success-auditor` must PASS. FAIL → back to Sentinel → Orchestrator (Ralph Loop).

## Artifacts

Required under `.teamwork/` (see pattern.json artifacts.structure). Machine state in `state.json`, human-readable in `request.md`, `plan.md`, `progress.md`.

## Not Implemented Here

- Long Proof, Self Verification, Document Review, Iterative Coding, auto pattern selection — future patterns.

## Usage

1. `/teamwork <objective>` — Sentinel creates request, starts Orchestrator
2. Orchestrator decomposes, schedules, delegates via artifacts
3. Verification gates enforce quality
4. Success Auditor final check → Done

Programmatic: `node teamwork/orchestration/cli.js init --objective "..."` or `TeamworkEngine` API in `teamwork/orchestration/engine.ts`.

## Design Choices vs OCO

- OCO: PM → Orchestrator → Investigator/Auditor/Web-Search/Docs with spec approval gate
- Distributed Coding: Sentinel → Orchestrator → Explorer/Workers → Critic/Challenger/Auditor → Success Auditor with ownership, parallel workstreams, milestone DAG, Ralph Loop
- Preserves OCO depth enforcement, disposable subagents, handoff, permission model; replaces hierarchy and adds ownership/parallelism.
