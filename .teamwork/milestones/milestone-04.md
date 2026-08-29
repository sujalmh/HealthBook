# Milestone milestone-04: M4 Tests/Build/Adversarial & Final Hardening

Add env-gated supabase.test.ts verifying sync+hydration+offline fallback+rapid no-dup+isolation (skips if !DATABASE_URL). Keep cohesion.test.ts 28 green, ensure npm test 133+ PASS, test-runner 231 PASS, lint 0, build 1660+ 40 tools, dist built. Challenger adversarial for missing URL, Supabase error, rapid sync, multi-patient isolation. Verify grep baqduk 0 outside .env, grep p_devi_78 0, seedBaseline 0, EventBus matrix intact.

- Workstreams: ws-04-01, ws-04-02
- DependsOn: milestone-03
- Status: pending
