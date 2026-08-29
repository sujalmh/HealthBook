# Milestone milestone-03: M3 Bootstrap Integration & Fallback

Update src/main.tsx / src/core/vault/seed.ts bootstrap to: if (isSupabaseEnabled()) { try hydrateFromSupabase(CANONICAL); if (hydrated>0) skip seed; else seedIfEmpty } else seedIfEmpty idempotent. Ensure seedIfEmpty remains single source (no per-view seeds regress). Preserve App.tsx hidden wrappers, ensure wireLocalVaultToEventBus remains. Handle bootstrap async hydration before React mount, with fallback to local seed on error/offline.

- Workstreams: ws-03-01
- DependsOn: milestone-02
- Status: pending
