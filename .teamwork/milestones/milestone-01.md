# Milestone milestone-01: M1 Iterative AI Refactor (R1+R2+R3)

Fix hardcoded AI responses, verify completions and responses with file inputs (file+text single request), remove test hacks (isTestEnv, synthetic, dedup fallbacks, proper AbortSignal globalThis.AbortController always), keep diff small iterative single worker on main, thorough multimodal testing 4+ cases (chat+file, chat text-only, responses+file, responses text-only plus timeout and 500 error)

- Workstreams: ws-iterative-ai-refactor
- DependsOn: none
- Status: in_progress
- Owner Role: worker_iterative_ai_refactor

Acceptance per prompt.md R1-R3 with Independent Verification probes — grep gates + ai-request-verification.log 4+ cases + lint/build/test/runner WebMCP40.
