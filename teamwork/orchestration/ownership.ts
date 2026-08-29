/**
 * File Ownership Tracking — Distributed Coding
 * Prevents concurrent edits to same file by different workers.
 * Implements explicit ownership per task requirement:
 * {
 *   workstream: "auth-refactor",
 *   files: ["src/auth/*", "tests/auth/*"],
 *   owner: "worker-1",
 *   status: "active"
 * }
 */

import type { OwnershipEntry, Workstream } from './state.js';

export interface OwnershipConflict {
  filePattern: string;
  workstreams: string[];
  owners: string[];
  severity: 'error' | 'warning';
}

/**
 * Simple glob overlap detection.
 * Supports exact files and glob-like prefixes with star.
 * For our purposes, we check if two patterns could match the same file.
 * Conservative: if uncertain, report conflict.
 */
export function patternsOverlap(a: string, b: string): boolean {
  // exact match
  if (a === b) return true;

  // Normalize: remove trailing slash
  const normA = a.replace(/\/$/, '');
  const normB = b.replace(/\/$/, '');

  // Helper: convert glob to regex-like prefix check (simple)
  const globToPrefix = (g: string): { prefix: string; isWildcard: boolean } => {
    // find first * or **
    const starIndex = g.indexOf('*');
    if (starIndex === -1) return { prefix: g, isWildcard: false };
    return { prefix: g.slice(0, starIndex), isWildcard: true };
  };

  const aInfo = globToPrefix(normA);
  const bInfo = globToPrefix(normB);

  // If neither is wildcard, only exact match overlaps (handled above) — no overlap
  if (!aInfo.isWildcard && !bInfo.isWildcard) return false;

  // If one is prefix wildcard, check if other's prefix starts with it or vice versa
  // e.g., "src/auth/*" prefix "src/auth/" overlaps with "src/auth/login.ts" prefix "src/auth/login.ts"
  // and "src/auth/*" overlaps with "src/auth/*"
  if (aInfo.isWildcard && bInfo.isWildcard) {
    // both wildcards: overlap if one prefix is prefix of the other, or they share common prefix before star
    // e.g., "src/auth/*" and "src/auth/login/*" overlap because login is inside auth
    // e.g., "src/auth/*" and "src/other/*" don't overlap
    const common = aInfo.prefix === bInfo.prefix ||
      aInfo.prefix.startsWith(bInfo.prefix) ||
      bInfo.prefix.startsWith(aInfo.prefix);
    return common;
  }

  // One wildcard, one exact
  const wildcard = aInfo.isWildcard ? aInfo : bInfo;
  const exact = aInfo.isWildcard ? normB : normA;

  // Check if exact file path is under wildcard prefix
  // e.g., wildcard "src/auth/*" prefix "src/auth/" matches exact "src/auth/login.ts"
  if (exact.startsWith(wildcard.prefix)) return true;
  // Also check if exact is a directory that contains wildcard prefix (less common)
  if (wildcard.prefix.startsWith(exact + '/')) return true;

  // Handle **: treat as prefix too (already covered)
  return false;
}

export function workstreamsOverlap(wsA: Workstream, wsB: Workstream): OwnershipConflict | null {
  for (const fileA of wsA.files) {
    for (const fileB of wsB.files) {
      if (patternsOverlap(fileA, fileB)) {
        return {
          filePattern: `${fileA} ↔ ${fileB}`,
          workstreams: [wsA.id, wsB.id],
          owners: [wsA.owner || 'unassigned', wsB.owner || 'unassigned'],
          severity: 'error',
        };
      }
    }
  }
  return null;
}

export function detectConflicts(workstreams: Workstream[]): OwnershipConflict[] {
  const conflicts: OwnershipConflict[] = [];
  for (let i = 0; i < workstreams.length; i++) {
    for (let j = i + 1; j < workstreams.length; j++) {
      const a = workstreams[i];
      const b = workstreams[j];
      // only consider active/pending workstreams that would run concurrently
      // if one is completed, no conflict
      if (a.status === 'completed' || b.status === 'completed') continue;
      // if both pending but will be scheduled in same batch, they conflict if overlap
      // For now, report all overlapping regardless of dependsOn — scheduler will serialize if dependsOn
      const conflict = workstreamsOverlap(a, b);
      if (conflict) {
        // check if they have dependency relationship — then they won't run in parallel, so not a conflict
        const hasDependency = a.dependsOn?.includes(b.id) || b.dependsOn?.includes(a.id);
        if (!hasDependency) {
          conflicts.push(conflict);
        }
      }
    }
  }
  return conflicts;
}

export function detectConflictsInEntries(entries: OwnershipEntry[]): OwnershipConflict[] {
  const conflicts: OwnershipConflict[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.status === 'completed' || b.status === 'completed') continue;
      for (const fileA of a.files) {
        for (const fileB of b.files) {
          if (patternsOverlap(fileA, fileB)) {
            // check if different owners and both active
            if (a.owner !== b.owner && a.status === 'active' && b.status === 'active') {
              conflicts.push({
                filePattern: `${fileA} ↔ ${fileB}`,
                workstreams: [a.workstream, b.workstream],
                owners: [a.owner, b.owner],
                severity: 'error',
              });
            } else {
              // if pending but same files with different owners, still conflict for parallel planning
              // (completed already excluded above, so remaining are active/pending/failed)
              if (a.workstream !== b.workstream && patternsOverlap(fileA, fileB)) {
                // avoid duplicates
                const exists = conflicts.some(c =>
                  c.workstreams.includes(a.workstream) && c.workstreams.includes(b.workstream)
                );
                if (!exists) {
                  conflicts.push({
                    filePattern: `${fileA} ↔ ${fileB}`,
                    workstreams: [a.workstream, b.workstream],
                    owners: [a.owner, b.owner],
                    severity: 'error',
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  return conflicts;
}

export function canScheduleTogether(workstreams: Workstream[]): boolean {
  return detectConflicts(workstreams).length === 0;
}

export function validateNoOverlapOrThrow(workstreams: Workstream[]): void {
  const conflicts = detectConflicts(workstreams);
  if (conflicts.length > 0) {
    const detail = conflicts.map(c => `${c.workstreams.join(',')} on ${c.filePattern}`).join('; ');
    throw new Error(`Ownership conflict detected: ${detail}. Orchestrator must serialize or repartition.`);
  }
}
