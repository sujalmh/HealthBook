# Research — Spec Miner Patterns-Config — 2026-08-30

Scope: patterns & agents & config

## Findings file:line
- ~/.config/opencode/teamwork/patterns/distributed-coding/pattern.json:1-6 canonical v1.0.0 antigravity, 6-40 sentinel depth0, 41-64 dispatcher 0.5, 66-103 team-orchestrator depth1, 104-129 explorer depth2 read-only, 131-152 worker isolated worktrees, 153-214 gates critic/challenger/auditor, 215-239 success-auditor final, 241-273 milestone-gate adaptive N+M+1 demo 1+1, 275-305 artifactsDir .teamwork BRIEFING GATE_STATUS PROJECT TEST_INFRA handoff
- opencode.json:8 subagent_depth 3, 9-33 permission *.env deny, 35-48 provider commandcode 1 baseURL https://api.commandcode.ai/provider/v1 models 3, 50-67 agent build plan, 68 model muse-spark fallback but inherited-from-chat per BRIEFING
- .env.example:14 VITE_AI_ENABLED false, 22 PROVIDER chat|responses, 28 BASE_URL https://opencode.ai/zen/go/v1 example only, 33 MODEL deepseek example 34 VISION_MODEL 41 STRUCTURED true optional ORG_ID etc total 13 VITE_AI_* keys
- .teamwork/state.json:5 objective generic configurable AI Settings>env vision, 28 integrityMode demo, 29 distributed-coding artifactsDir .teamwork Q1
- .teamwork/BRIEFING.md:13 spawn 0/16 3 miners dead-man 600s 19:10Z, 23 inherited-from-chat, 9 Settings>env src/components/settings + src/core/settings
- .teamwork/GATE_STATUS.md:5 M0 planning IN_PROGRESS, 16 spawn tracking 0/16→16/16 at limit succession before M3
- .teamwork/plan.md:11-74 M1 engine/catalog DISJOINT M2 bootstrap M3 ui/regression DISJOINT, 77-82 schedule inherited-from-chat dead-man
- .teamwork/PROJECT.md:5 WorkingDir .teamwork pattern distributed-coding, 12-16 repo layout
- .gitignore:4 .env, 12 worktrees/handoff ignore, 14 **/*.log
- src/main.tsx:14 AbortController, 92 isSecureContext, 102 allowsFeature tools, 136 allSettled, src/App.tsx 103 localStorage carecanvas_active_user no Settings page
- Settings green field glob 0 files grep only font-feature-settings + CareCircleView Settings icon + Dossier Share Settings

Counts: VITE_AI 13 keys in .env.example 81 total 0 in src, opencode 1 provider 3 models permission 13 deny agent 2, pattern 8 roles 2 gates 17 steps 3 milestones M0→M1→M2→M3

## Dependencies
Sentinel→Dispatcher→Orchestrator→spec miners→PROJECT/TEST_INFRA/plan→Workers worktrees→Gates→Success Auditor→Done, handoff/succession at 15/16

## Affected Files
~/.config/opencode/teamwork/patterns/**, opencode.json, .env.example, .gitignore, .teamwork/state.json, .teamwork/plan.md, .teamwork/PROJECT.md, .teamwork/BRIEFING.md, .teamwork/GATE_STATUS.md, .teamwork/request.md, .teamwork/prompt*.md, src/main.tsx, src/App.tsx, src/components/settings/**, src/core/settings/**, src/core/ai/**

## Unknowns
teamwork/orchestration/* not local, opencode teamwork model absent, dead-man exact, handoff dual, .env not readable, src/core/ai generic branching not coded

## Tool Discipline
glob grep read only, no bash
