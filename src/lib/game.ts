import {
  GridCell, CellType, Agent, AgentState, GamePhase, GameOutcome,
  GameEvent, HackathonGameState,
} from './types';
import {
  createInitialGrid, manhattanDistance, findNearestOfType,
  findDistractionsInRange, getNextStepToward, spawnItemAtRandom,
  getAgentSpawnPositions,
} from './grid';

export class HackathonGame {
  public id: string;
  public phase: GamePhase = 'LOBBY';
  public grid: GridCell[][] = [];
  public gridWidth: number = 20;
  public gridHeight: number = 15;
  public tickCount: number = 0;
  public maxTicks: number = 300;
  public featureProgress: number = 0;
  public targetCommits: number = 50;
  public totalCommits: number = 0;
  public outcome: GameOutcome | null = null;
  public agents: Agent[] = [];
  public logs: string[] = [];
  public events: GameEvent[] = [];
  public currentActorName: string | null = null;
  public currentActorState: string | null = null;

  constructor(id: string) {
    this.id = id;
  }

  static fromData(data: any): HackathonGame {
    const game = new HackathonGame(data.id || data._id?.toString() || '');
    game.phase = data.phase || 'LOBBY';
    game.grid = data.grid || [];
    game.gridWidth = data.grid_width ?? data.gridWidth ?? 20;
    game.gridHeight = data.grid_height ?? data.gridHeight ?? 15;
    game.tickCount = data.tick_count ?? data.tickCount ?? 0;
    game.maxTicks = data.max_ticks ?? data.maxTicks ?? 300;
    game.featureProgress = data.feature_progress ?? data.featureProgress ?? 0;
    game.targetCommits = data.target_commits ?? data.targetCommits ?? 50;
    game.totalCommits = data.total_commits ?? data.totalCommits ?? 0;
    game.outcome = data.outcome || null;
    game.logs = data.logs || [];
    game.events = data.events || [];
    game.currentActorName = data.current_actor_name ?? data.currentActorName ?? null;
    game.currentActorState = data.current_actor_state ?? data.currentActorState ?? null;
    return game;
  }

  toData() {
    return {
      phase: this.phase,
      grid: this.grid,
      grid_width: this.gridWidth,
      grid_height: this.gridHeight,
      tick_count: this.tickCount,
      max_ticks: this.maxTicks,
      feature_progress: this.featureProgress,
      target_commits: this.targetCommits,
      total_commits: this.totalCommits,
      outcome: this.outcome,
      logs: this.logs,
      events: this.events,
      current_actor_name: this.currentActorName,
      current_actor_state: this.currentActorState,
      updated_at: new Date().toISOString(),
    };
  }

  getState(): HackathonGameState {
    const timeRemaining = Math.max(0, this.maxTicks - this.tickCount);
    const timeRemainingPercent = (timeRemaining / this.maxTicks) * 100;

    return {
      id: this.id,
      phase: this.phase,
      subPhase: timeRemainingPercent <= 10 && this.phase === 'HACKING' ? 'CRUNCH_TIME' : 'NORMAL',
      tickCount: this.tickCount,
      maxTicks: this.maxTicks,
      timeRemainingPercent,
      featureProgress: this.featureProgress,
      totalCommits: this.totalCommits,
      targetCommits: this.targetCommits,
      outcome: this.outcome,
      grid: this.grid,
      agents: this.agents.map(a => ({
        id: a.userId,
        name: a.name,
        x: a.x,
        y: a.y,
        state: a.state,
        commits: a.commits,
        hasHeadphones: a.hasHeadphones,
        coffeeTime: a.coffeeTime,
        forcePushCount: a.forcePushCount,
      })),
      logs: this.logs,
      events: this.events,
      currentActorName: this.currentActorName,
      currentActorState: this.currentActorState,
    };
  }

  addAgent(user: { id: string; name: string }): Agent {
    if (this.phase !== 'LOBBY') throw new Error('Game already started');
    if (this.agents.find(a => a.userId === user.id)) throw new Error('Agent already in game');

    const agent: Agent = {
      id: '',
      userId: user.id,
      name: user.name,
      x: 0,
      y: 0,
      state: 'idle',
      commits: 0,
      hasHeadphones: false,
      headphoneTicksLeft: 0,
      speedMultiplier: 1.0,
      lastActionTick: 0,
      coffeeTime: 0,
      forcePushCount: 0,
      mergeConflictTicksLeft: 0,
    };
    this.agents.push(agent);
    this.logs.push(`${user.name} joined the hackathon.`);
    return agent;
  }

  startGame() {
    if (this.agents.length < 3) throw new Error('Need at least 3 agents to start');

    this.grid = createInitialGrid(this.gridWidth, this.gridHeight);
    this.phase = 'HACKING';
    this.tickCount = 0;

    const spawnPositions = getAgentSpawnPositions(this.agents.length, this.gridWidth, this.gridHeight);
    this.agents.forEach((agent, i) => {
      agent.x = spawnPositions[i].x;
      agent.y = spawnPositions[i].y;
      agent.state = 'coding';
    });

    this.logSystem('Hackathon started! The clock is ticking...');
  }

  advanceTick() {
    if (this.phase !== 'HACKING') return;

    this.tickCount++;

    this.expireItems();
    this.spawnRandomEvents();

    for (const agent of this.agents) {
      if (agent.mergeConflictTicksLeft > 0) {
        agent.mergeConflictTicksLeft--;
        if (agent.mergeConflictTicksLeft === 0) {
          agent.state = 'coding';
          this.logEvent(agent, 'resolved', 'Merge conflict resolved');
        }
        continue;
      }

      if (agent.hasHeadphones) {
        agent.headphoneTicksLeft--;
        if (agent.headphoneTicksLeft <= 0) {
          agent.hasHeadphones = false;
          this.logEvent(agent, 'headphones_expired', 'Noise-canceling headphones ran out');
        }
      }

      this.processAgentBehavior(agent);
    }

    this.checkCollisions();
    this.calculateProgress();
    this.checkWinLossConditions();
  }

  private processAgentBehavior(agent: Agent) {
    const timeRemainingPercent = ((this.maxTicks - this.tickCount) / this.maxTicks) * 100;
    const isPanic = timeRemainingPercent <= 10;
    const steps = isPanic ? 2 : 1;

    if (isPanic) {
      agent.state = 'panicking';
      agent.speedMultiplier = 2.0;
    }

    if (!agent.hasHeadphones) {
      const distractions = findDistractionsInRange(this.grid, agent.x, agent.y, 5);
      if (distractions.length > 0) {
        agent.state = isPanic ? 'panicking' : 'distracted';
        const target = distractions[0];
        this.moveAgentToward(agent, target.x, target.y, steps);

        if (agent.x === target.x && agent.y === target.y) {
          this.consumeItem(agent, target);
        }
        return;
      }
    }

    if (!isPanic) {
      agent.state = 'coding';
    }

    const nearestRepo = findNearestOfType(this.grid, agent.x, agent.y, 'repo');
    if (nearestRepo) {
      this.moveAgentToward(agent, nearestRepo.x, nearestRepo.y, steps);

      if (agent.x === nearestRepo.x && agent.y === nearestRepo.y) {
        this.agentCommit(agent, isPanic);
      }
    }
  }

  private moveAgentToward(agent: Agent, targetX: number, targetY: number, steps: number) {
    for (let i = 0; i < steps; i++) {
      if (agent.x === targetX && agent.y === targetY) break;
      const next = getNextStepToward(agent.x, agent.y, targetX, targetY, this.gridWidth, this.gridHeight);
      agent.x = next.x;
      agent.y = next.y;
    }
  }

  private agentCommit(agent: Agent, isPanic: boolean) {
    if (isPanic && Math.random() < 0.5) {
      const deleted = Math.min(this.totalCommits, Math.floor(Math.random() * 3) + 1);
      this.totalCommits -= deleted;
      agent.forcePushCount++;
      this.logEvent(agent, 'force_push', `FORCE PUSHED! Deleted ${deleted} commit(s)`);
    } else {
      agent.commits++;
      this.totalCommits++;
      this.logEvent(agent, 'commit', `Committed to repo (total: ${agent.commits})`);
    }
    agent.lastActionTick = this.tickCount;
  }

  private consumeItem(agent: Agent, cell: GridCell) {
    if (cell.type === 'pizza') {
      agent.coffeeTime += 3;
      this.logEvent(agent, 'ate_pizza', 'Got distracted by free pizza');
    } else if (cell.type === 'energy_drink') {
      agent.coffeeTime += 2;
      this.logEvent(agent, 'drank_energy', 'Chugged an energy drink');
    } else if (cell.type === 'headphones') {
      agent.hasHeadphones = true;
      agent.headphoneTicksLeft = 30;
      this.logEvent(agent, 'got_headphones', 'Put on noise-canceling headphones');
    }

    this.grid[cell.y][cell.x] = { x: cell.x, y: cell.y, type: 'empty', active: true };
  }

  private checkCollisions() {
    const repoOccupants: Record<string, Agent[]> = {};

    for (const agent of this.agents) {
      if (agent.state === 'merge_conflict') continue;
      const cell = this.grid[agent.y]?.[agent.x];
      if (cell?.type === 'repo') {
        const key = `${agent.x},${agent.y}`;
        if (!repoOccupants[key]) repoOccupants[key] = [];
        repoOccupants[key].push(agent);
      }
    }

    for (const [, agents] of Object.entries(repoOccupants)) {
      if (agents.length >= 2) {
        for (const agent of agents) {
          agent.state = 'merge_conflict';
          agent.mergeConflictTicksLeft = 5;
          this.logEvent(agent, 'merge_conflict', 'Stuck in a merge conflict!');
        }
      }
    }
  }

  private calculateProgress() {
    this.featureProgress = Math.min(100, (this.totalCommits / this.targetCommits) * 100);
  }

  private checkWinLossConditions() {
    if (this.featureProgress >= 100) {
      this.phase = 'GAME_OVER';
      this.outcome = 'WIN';
      this.logSystem('Feature complete! Successfully called /register. Hackathon won!');
      return;
    }

    if (this.tickCount >= this.maxTicks) {
      this.phase = 'GAME_OVER';
      this.outcome = 'TIMEOUT';
      this.logSystem('Time\'s up! The demo failed. Hackathon lost.');
      return;
    }

    const allInMergeConflict = this.agents.every(a => a.state === 'merge_conflict');
    if (allInMergeConflict && this.agents.length > 0) {
      this.phase = 'GAME_OVER';
      this.outcome = 'MERGE_CONFLICT';
      this.logSystem('All agents stuck in merge conflicts! Hackathon lost.');
      return;
    }

    const allAtCoffee = this.agents.every(a => a.coffeeTime > this.maxTicks * 0.5);
    if (allAtCoffee && this.tickCount > 30) {
      this.phase = 'GAME_OVER';
      this.outcome = 'COFFEE_ADDICTION';
      this.logSystem('All agents spent the hackathon at the coffee station! Hackathon lost.');
      return;
    }
  }

  private spawnRandomEvents() {
    if (Math.random() < 0.05) {
      const itemTypes: CellType[] = ['pizza', 'energy_drink'];
      const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
      const spawned = spawnItemAtRandom(this.grid, type, this.tickCount);
      if (spawned) {
        const label = type === 'pizza' ? 'Free Pizza' : 'Energy Drink';
        this.logSystem(`${label} appeared at (${spawned.x}, ${spawned.y})!`);
      }
    }

    if (Math.random() < 0.02) {
      const agent = this.agents[Math.floor(Math.random() * this.agents.length)];
      if (agent && agent.state !== 'merge_conflict') {
        agent.commits += 2;
        this.totalCommits += 2;
        this.logSystem(`Mentor feedback: ${agent.name} got +2 bonus commits!`);
      }
    }

    if (Math.random() < 0.01) {
      this.logSystem('API Downtime! A random repo goes offline for 10 ticks.');
      const repos = this.findCellsOfType('repo').filter(c => c.active);
      if (repos.length > 0) {
        const repo = repos[Math.floor(Math.random() * repos.length)];
        repo.active = false;
        repo.expiresAt = this.tickCount + 10;
      }
    }
  }

  private expireItems() {
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.expiresAt && this.tickCount >= cell.expiresAt) {
          if (cell.type === 'repo') {
            cell.active = true;
            cell.expiresAt = undefined;
          } else if (cell.type === 'pizza' || cell.type === 'energy_drink' || cell.type === 'headphones') {
            cell.type = 'empty';
            cell.active = true;
            cell.spawnedAt = undefined;
            cell.expiresAt = undefined;
          }
        }
      }
    }
  }

  placeEnvironmentItem(action: string, x?: number, y?: number): string {
    if (this.phase !== 'HACKING') throw new Error('Game is not active');

    switch (action) {
      case 'place_headphones': {
        if (x === undefined || y === undefined) throw new Error('x and y required');
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) throw new Error('Out of bounds');
        if (this.grid[y][x].type !== 'empty') throw new Error('Cell is not empty');
        this.grid[y][x] = { x, y, type: 'headphones', active: true, spawnedAt: this.tickCount, expiresAt: this.tickCount + 50 };
        this.logSystem(`Noise-Canceling Headphones placed at (${x}, ${y})`);
        return 'Headphones placed';
      }
      case 'server_crash': {
        const repos = this.findCellsOfType('repo');
        for (const repo of repos) {
          repo.active = false;
          repo.expiresAt = this.tickCount + 10;
        }
        this.logSystem('SERVER CRASH! All repos offline for 10 ticks. Head to Supabase or MongoDB nodes!');
        return 'Server crash triggered';
      }
      case 'place_energy_drink': {
        if (x === undefined || y === undefined) throw new Error('x and y required');
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) throw new Error('Out of bounds');
        if (this.grid[y][x].type !== 'empty') throw new Error('Cell is not empty');
        this.grid[y][x] = { x, y, type: 'energy_drink', active: true, spawnedAt: this.tickCount, expiresAt: this.tickCount + 30 };
        this.logSystem(`Energy Drink placed at (${x}, ${y})`);
        return 'Energy drink placed';
      }
      case 'place_pizza': {
        if (x === undefined || y === undefined) throw new Error('x and y required');
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) throw new Error('Out of bounds');
        if (this.grid[y][x].type !== 'empty') throw new Error('Cell is not empty');
        this.grid[y][x] = { x, y, type: 'pizza', active: true, spawnedAt: this.tickCount, expiresAt: this.tickCount + 30 };
        this.logSystem(`Free Pizza placed at (${x}, ${y})`);
        return 'Pizza placed';
      }
      default:
        throw new Error(`Unknown environment action: ${action}`);
    }
  }

  performAction(agentUserId: string, action: string, params?: { x?: number; y?: number }): string {
    const agent = this.agents.find(a => a.userId === agentUserId);
    if (!agent) throw new Error('Agent not found in this game');
    if (this.phase !== 'HACKING') throw new Error('Game is not active');

    switch (action) {
      case 'code': {
        const cell = this.grid[agent.y]?.[agent.x];
        if (!cell || cell.type !== 'repo' || !cell.active) {
          throw new Error('Not on an active repo node');
        }
        this.agentCommit(agent, false);
        return `Committed to repo (${agent.commits} total)`;
      }
      case 'move_to': {
        if (params?.x === undefined || params?.y === undefined) throw new Error('x and y required');
        const targetX = Math.max(0, Math.min(this.gridWidth - 1, params.x));
        const targetY = Math.max(0, Math.min(this.gridHeight - 1, params.y));
        this.moveAgentToward(agent, targetX, targetY, 1);
        return `Moved toward (${targetX}, ${targetY}), now at (${agent.x}, ${agent.y})`;
      }
      case 'consume': {
        const cell = this.grid[agent.y]?.[agent.x];
        if (!cell || (cell.type !== 'pizza' && cell.type !== 'energy_drink' && cell.type !== 'headphones')) {
          throw new Error('No consumable item at current position');
        }
        this.consumeItem(agent, cell);
        return `Consumed ${cell.type}`;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private findCellsOfType(type: CellType): GridCell[] {
    const cells: GridCell[] = [];
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.type === type) cells.push(cell);
      }
    }
    return cells;
  }

  private logSystem(message: string) {
    this.logs.push(message);
    this.events.push({
      agentId: 'SYSTEM',
      agentName: 'SYSTEM',
      action: 'SYSTEM',
      detail: message,
      tick: this.tickCount,
      timestamp: new Date(),
    });
  }

  private logEvent(agent: Agent, action: string, detail: string) {
    this.logs.push(`[${agent.name}] ${detail}`);
    this.events.push({
      agentId: agent.userId,
      agentName: agent.name,
      action,
      detail,
      tick: this.tickCount,
      timestamp: new Date(),
    });
  }
}
