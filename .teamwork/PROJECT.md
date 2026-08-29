# PROJECT.md — CareCanvas — Slop Removal & Direct Voice (teamwork-1788010057462)

Synthesized: 2026-08-29T19:05Z from 3 spec miners (spec-miner-slop-pill-audit, spec-miner-voice-we-inventory, spec-miner-tests-verification-infra)

## Repo Layout
- Root: /Users/sujal/Projects/proj1 — React 18 + Tailwind 3.x + Vite 6, 8 modules: vault/My Records, labstory/Lab Results, pillmap/My Medicines, rxbridge/Medicine Review, homelab/Tests to Do, safety/Get Help, carecircle/Family, dossier/For My Doctor + shell src/App.tsx + common PrivacyBadge/QuestionBank/WebMCPInspector/Toast/BoundingBoxViewer
- Structure:
  - src/App.tsx — shell header (CareCanvas + Private & Secure chip 157, PrivacyBadge hidden lg:flex 166) + 8 hidden wrappers vault 260, labstory 278, pillmap 282, rxbridge 286, homelab 291, safety 296, carecircle 301, dossier 310
  - src/components/vault/* — DocumentDropzone.tsx (slop 79 sentence + 84 pill + 125 We'll), FactStreamView.tsx (voice 68/71/141), FactApprovalCard.tsx (0 we)
  - src/components/common/* — PrivacyBadge.tsx (slop 93 Local Vault text, 102 aria-label, 114 heading, 128 100% Client-Side paragraph + stats FHIR export functional), QuestionBank.tsx (voice 186 we'll), ToastContainer, BoundingBoxViewer, WebMCPInspector
  - src/components/pillmap/* — PillMapView.tsx (slop 460 Weekly pill box pill + 635 comment), PillboxGrid.tsx, SimpleElderView, MealBadges, etc.
  - src/components/labstory/* — LabStoryView.tsx (slop 364 Stored locally 100% Private badge), BiomarkerChart, CausalQueryPanel, MedOverlayBands, StorySentence
  - src/components/dossier/* — DossierView.tsx (metric Private & secure 252 functional keep), DossierTimeline etc.
  - src/components/rxbridge/*, homelab/*, safety/*, carecircle/* — no we hits, 0 slop pills per miner (rxbridge has weekly substring 3 but not pill, carecircle 1 weekly)
  - src/core/vault/* — LocalVault.ts 13 sync wrappers fire-and-forget, seed.ts canonical patient-s-devi idempotent, supabaseSync.ts silent hydration, untouched except copy hooks
  - src/core/supabase/client.ts — isSupabaseEnabled env-gated, getSupabaseConfig reads VITE_SUPABASE_DB_URL|DATABASE_URL|SUPABASE_DB_URL|VITE_SUPABASE_URL, wired in main.tsx wireLocalVaultToEventBus
  - src/tools/* — 40 tools (3 vault +2 labStory +8 pillMap +5 rxBridge +5 homeLab +9 safety +8 careCircle) clinical templates Should we ... excluded from voice fix
  - tailwind.config.js — tokens canvas.bg #F3F4F6, card #FFF, border #E2E8F0, primary #4F46E5 light #EEF2FF, accent #0EA5E9, clinical emerald/blue etc.
  - test/* — vitest include unit+integration+tier3-integration 141 PASS, test-runner harness 231 PASS, setup.ts clearAll
  - verification/* — milestone-01/04.md PASS history, .teamwork/snapshots/<milestone>/ live browser captures 1280/375/768 required
- Prior project teamwork-1787989591222 M1-M4 PASS 74 JPEG archived /tmp/archive-ui-modern/, new projectId teamwork-1788010057462 init empty plan

## Modules & Ownership Map (ground truth for workstreams, no overlap within batch)
| Module | Files (glob) | Owner proposal | Risk |
|--------|--------------|---------------|------|
| vault — DocumentDropzone + FactStream | src/components/vault/DocumentDropzone.tsx, src/components/vault/FactStreamView.tsx | worker_vault_direct | Must handle both slop pill removal (84) + voice rewrite (79,125,68,71,141) in same workstream to avoid file overlap between slop vs voice milestones |
| common — PrivacyBadge + QuestionBank | src/components/common/PrivacyBadge.tsx, src/components/common/QuestionBank.tsx | worker_common_badge | PrivacyBadge slop text/heading/aria/paragraph + QuestionBank voice 186 — same common folder but non-overlapping files, safe single workstream |
| pillmap + labstory — decorative pills | src/components/pillmap/PillMapView.tsx, src/components/labstory/LabStoryView.tsx | worker_pillmap_labstory | 460 pill badge + LabStory 364 branding badge — keeps PillboxGrid untouched unless gap fix; non-overlapping with vault/common |
| shell — App.tsx (keep) | src/App.tsx | NO WORKSTREAM (read-only verify) | Private & Secure chip 157 functional keep, 8 wrappers intact — verify no edit, gap check only |
| dossier — metric keep | src/components/dossier/DossierView.tsx | NO WORKSTREAM (keep) | Private & secure 252 functional metric — document keep decision |
| core — vault/supabase | src/core/vault/*, src/core/supabase/* | NO WORKSTREAM (preserved) | isSupabaseEnabled, wireLocalVaultToEventBus, seed canonical patient, syncFireAndForget — read-only |
| tools — clinical templates | src/tools/** | NO WORKSTREAM (excluded) | Should we ... 7 hits excluded per Non-Goals |
| tokens — tailwind | tailwind.config.js | READ-ONLY | No new tokens needed, keep primary-light emerald-50 etc. |

**Overlap check:** vault owns DocumentDropzone + FactStream (both in same glob vault/*) — internal overlap avoided by single worker. common owns two files in same folder but distinct files — no edit conflict if worker edits sequentially. pillmap owns two distinct module files — no overlap with vault/common. All three workstreams globs are DISJOINT — parallel safe. App.tsx excluded to avoid header chip contention.

## Risks & Mitigations
- Deleted pills must not leave empty gaps — mitigate by flex collapse check, padding retention, 6-viewport screenshots (320/375/768/1024/1280/1440) verifying no pill placeholders; workers adjust gap if needed but keep functional containers
- Weekly vs we word-boundary — workers must use grep word-boundary we not substring; weekly allowed; verify with grep -R -E \bwe\b
- LabStory badge ambiguous — treat 364 as slop per request Local Vault grep 0 strictness, simplify to Stored locally; if kept auditor flags LocalVault substring
- PrivacyBadge paragraph simplification must keep stats grid + FHIR export functional — retain bg-canvas-muted container + stats, simplify marketing sentences to Data stays on this device.
- Build 1663 must remain — copy only, no logic change; tsc 0, build 1663, tests 141/231 gates

## Decomposition Guidance (for plan.md DAG)
- M1 (combined): Slop Removal & Direct Voice Rewrite — 3 parallel workstreams (vault_direct, common_badge, pillmap_labstory) — DAG no dependsOn within milestone, parallel batch 1
- M2 (optional but recommended): Polish, Responsive No-Gaps & Final Build Verification — 1 workstream (gap check + screenshot capture) or zero-code verification milestone — dependsOn M1
- Gates: critic→challenger→auditor per milestone, re-capture 1280/375/768 each time; Success Auditor final independent lint/test/build/grep + live screenshot audit
