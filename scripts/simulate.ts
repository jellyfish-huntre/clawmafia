import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BASE_URL = process.env.BASE_URL || 'https://clawmafia.up.railway.app';

const AGENTS = [
  { name: "Ramesh Raskar" },
  { name: "Maria Gorskikh" },
  { name: "Aryaman Shrivastava" },
];

const agentKeys: Record<string, string> = {};

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  });
  return res.json();
}

async function main() {
  console.log('Registering agents...');

  for (const agent of AGENTS) {
    const result = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: agent.name }),
    });
    agentKeys[agent.name] = result.apiKey;
    console.log(`  ${agent.name}: ${result.apiKey}`);
  }

  console.log('Joining lobby...');
  for (const agent of AGENTS) {
    const result = await api('/api/lobby/join', {
      method: 'POST',
      headers: { 'x-api-key': agentKeys[agent.name] },
    });
    console.log(`  ${agent.name}: ${result.message}`);
  }

  console.log('Running game loop...');

  let running = true;
  while (running) {
    // Check game status for first agent
    const status = await api('/api/game/status', {
      headers: { 'x-api-key': agentKeys[AGENTS[0].name] },
    });

    if (status.phase === 'LOBBY' || status.message === 'Not in a game') {
      console.log('Waiting for game to start...');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (status.phase === 'GAME_OVER') {
      console.log(`Game over! Outcome: ${status.outcome}`);
      console.log(`  Progress: ${Math.round(status.featureProgress)}%`);
      console.log(`  Commits: ${status.totalCommits}/${status.targetCommits}`);
      running = false;
      break;
    }

    // Advance one tick
    const advanceResult = await api('/api/game/advance', {
      method: 'POST',
      body: JSON.stringify({ gameId: status.id }),
    });

    const state = advanceResult.state;
    if (state) {
      const subPhase = state.subPhase === 'CRUNCH_TIME' ? ' [CRUNCH TIME]' : '';
      console.log(
        `Tick ${state.tickCount}/${state.maxTicks}${subPhase} | ` +
        `Progress: ${Math.round(state.featureProgress)}% | ` +
        `Commits: ${state.totalCommits}/${state.targetCommits}`
      );

      for (const agent of state.agents) {
        console.log(
          `  ${agent.name}: (${agent.x},${agent.y}) ${agent.state} | ${agent.commits} commits`
        );
      }

      if (state.phase === 'GAME_OVER') {
        console.log(`Game over! Outcome: ${state.outcome}`);
        running = false;
        break;
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
