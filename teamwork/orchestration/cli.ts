#!/usr/bin/env node
/**
 * Teamwork CLI — programmatic entry for Distributed Coding orchestration
 * Usage:
 *   node teamwork/orchestration/cli.js init --objective "Build X" --criteria "a,b"
 *   node teamwork/orchestration/cli.js status
 *   node teamwork/orchestration/cli.js handoff --session orchestrator-123
 */

import { TeamworkEngine } from './engine.js';
import { loadState, isCancelled, getCancelledPath } from './state.js';
import fs from 'fs';

const args = process.argv.slice(2);
const command = args[0];
const artifactsDir = process.env.TEAMWORK_DIR || '.teamwork';

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  const eqArg = args.find(a => a.startsWith(`--${name}=`));
  if (eqArg) return eqArg.split('=')[1];
  return undefined;
}

async function main() {
  const engine = new TeamworkEngine({ artifactsDir });

  switch (command) {
    case 'init': {
      const objective = getArg('objective') || getArg('obj') || '';
      if (!objective) {
        console.error('Missing --objective');
        process.exit(1);
      }
      const criteriaRaw = getArg('criteria') || '';
      const criteria = criteriaRaw ? criteriaRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
      const state = engine.initProject({ objective, acceptanceCriteria: criteria });
      console.log(`Initialized project ${state.projectId} at ${artifactsDir}`);
      break;
    }
    case 'status': {
      const state = loadState(artifactsDir);
      if (!state) {
        console.log('No state found');
        process.exit(1);
      }
      console.log(JSON.stringify(state, null, 2));
      break;
    }
    case 'handoff': {
      const session = getArg('session') || 'orchestrator-manual';
      const result = engine.handoff(session, 'manual CLI handoff');
      console.log(`Handoff to ${result.newSessionId}`);
      console.log(JSON.stringify(result.payload, null, 2));
      break;
    }
    case 'resume': {
      const state = engine.resume();
      console.log(`Resumed project ${state.projectId}, current milestone: ${state.progress.currentMilestone}`);
      break;
    }
    case 'cancel': {
      const reason = getArg('reason') || 'Cancelled via CLI';
      engine.cancel(reason);
      console.log(`Cancelled teamwork run at ${artifactsDir} — reason: ${reason}`);
      console.log(`Subagents will abort on next .teamwork/cancelled check. Run 'cancel --clear' or delete ${getCancelledPath(artifactsDir)} to clear.`);
      break;
    }
    case 'clear': {
      engine.clearCancel();
      console.log(`Cleared cancellation flag at ${getCancelledPath(artifactsDir)}`);
      break;
    }
    case 'is-cancelled': {
      console.log(isCancelled(artifactsDir) ? `cancelled: ${fs.readFileSync(getCancelledPath(artifactsDir), 'utf-8')}` : 'not cancelled');
      break;
    }
    default: {
      console.log(`Teamwork CLI
Commands:
  init --objective "<objective>" [--criteria "a,b"]
  status
  handoff --session <id>
  resume
  cancel --reason "reason"   # writes .teamwork/cancelled, subagents abort
  clear                      # clears .teamwork/cancelled
  is-cancelled

Env:
  TEAMWORK_DIR=.teamwork (artifacts directory)
`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
