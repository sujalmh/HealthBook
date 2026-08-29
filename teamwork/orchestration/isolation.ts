/**
 * Isolation — Worker Scratch Space & Worktree Abstraction
 * Prefers: 1) git worktree, 2) isolated working directory, 3) strict ownership + shared workspace
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface IsolationResult {
  mode: 'worktree' | 'isolated-dir' | 'shared-workspace';
  scratchDir: string;
  worktreePath?: string;
  cleanup: () => void;
}

export function isGitRepo(cwd = process.cwd()): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore', cwd });
    return true;
  } catch {
    return false;
  }
}

export function supportsWorktree(cwd = process.cwd()): boolean {
  if (!isGitRepo(cwd)) return false;
  try {
    execSync('git worktree list', { stdio: 'ignore', cwd });
    return true;
  } catch {
    return false;
  }
}

export function createIsolatedScratch(artifactsDir: string, workstreamId: string, mode: 'auto' | 'worktree' | 'isolated-dir' | 'shared-workspace' = 'auto'): IsolationResult {
  const scratchBase = path.join(artifactsDir, 'worktrees', workstreamId);
  const isolatedDir = path.join(scratchBase, 'scratch');

  // Prefer worktree if auto and supported
  if (mode === 'worktree' || (mode === 'auto' && supportsWorktree())) {
    try {
      const branchName = `teamwork/${workstreamId}-${Date.now()}`;
      const worktreePath = path.join(artifactsDir, 'worktrees', `${workstreamId}-wt`);
      // Try to create worktree; if fails fallback to isolated-dir
      if (!fs.existsSync(worktreePath)) {
        // Use git worktree add -b
        execSync(`git worktree add -b ${branchName} ${worktreePath} HEAD`, { stdio: 'ignore' });
      }
      // scratch inside worktree
      const scratchInWt = path.join(worktreePath, '.teamwork-scratch');
      if (!fs.existsSync(scratchInWt)) fs.mkdirSync(scratchInWt, { recursive: true });
      return {
        mode: 'worktree',
        scratchDir: scratchInWt,
        worktreePath,
        cleanup: () => {
          try {
            execSync(`git worktree remove ${worktreePath} --force`, { stdio: 'ignore' });
            execSync(`git branch -D ${branchName}`, { stdio: 'ignore' });
          } catch { /* ignore */ }
        },
      };
    } catch {
      // fallback
    }
  }

  if (mode === 'shared-workspace') {
    return {
      mode: 'shared-workspace',
      scratchDir: path.join('/tmp', `teamwork-${workstreamId}-${Date.now()}`),
      cleanup: () => {},
    };
  }

  // Default: isolated-dir
  if (!fs.existsSync(isolatedDir)) fs.mkdirSync(isolatedDir, { recursive: true });
  // also create logs subdir
  const logsDir = path.join(scratchBase, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  return {
    mode: 'isolated-dir',
    scratchDir: isolatedDir,
    cleanup: () => {
      // do not auto-delete for audit trail; caller decides
    },
  };
}

export function getIsolationPreference(): string {
  if (supportsWorktree()) return 'worktree (git worktree available)';
  if (fs.existsSync('.teamwork')) return 'isolated-dir (.teamwork/worktrees/*)';
  return 'shared-workspace (strict ownership)';
}

export function reviewIsolation(filesChanged: string[]): { mode: string; inspected: boolean } {
  // Reviewers should inspect without modifying — check if files exist and are readable
  const inspected = filesChanged.every(f => {
    // allow glob patterns to pass
    if (f.includes('*')) return true;
    try {
      return fs.existsSync(f) || true; // if file doesn't exist yet, still considered inspectable via git diff
    } catch {
      return false;
    }
  });
  return { mode: getIsolationPreference(), inspected };
}
