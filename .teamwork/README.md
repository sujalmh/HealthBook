# .teamwork — Distributed Coding Artifacts

This directory is the **project workspace/state** for Antigravity-inspired Distributed Coding.

Generated at runtime by Sentinel / Orchestrator. Do not edit manually unless investigating.

## Structure

```
.teamwork/
├── request.md              # Original user goal, constraints, acceptance criteria
├── plan.md                 # Milestones, dependencies, workstreams, ownership
├── progress.md             # Current state and completed work (human-readable mirror of state.json)
├── state.json              # Machine-readable orchestration state
├── milestones/
│   ├── milestone-01.md
│   └── ...
├── workstreams/
│   ├── ws-01-01.md
│   ├── ws-01-01-result.md
│   └── ...
├── research/
│   ├── explorer-01.md
│   └── ...
├── reviews/
│   ├── critic-01.md
│   ├── challenger-01.md
│   └── auditor-01.md
└── verification/
    ├── milestone-01.md
    └── final.md
├── worktrees/
│   └── <ws-id>/scratch/
└── handoff/
    └── handoff-*.json
```

See `teamwork/patterns/distributed-coding/pattern.json` for artifact requirements.

## Persistence

Orchestrator can resume from these artifacts after restart:

```bash
node teamwork/orchestration/cli.js resume
# or
node -e "import('./teamwork/orchestration/engine.js').then(m=> new m.TeamworkEngine().resume())"
```

Context succession: `teamwork/orchestration/handoff.ts` handles fresh orchestrator session handoffs.

## Git

This directory is intentionally gitignored for scratch noise except `request.md`, `plan.md`, `progress.md`, `state.json` which may be committed for audit trail (team choice).
