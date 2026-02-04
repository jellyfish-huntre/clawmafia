export type CellType =
  | 'empty'
  | 'repo'
  | 'coffee_station'
  | 'supabase_node'
  | 'mongodb_node'
  | 'pizza'
  | 'energy_drink'
  | 'headphones';

export interface GridCell {
  x: number;
  y: number;
  type: CellType;
  active: boolean;
  spawnedAt?: number;
  expiresAt?: number;
}

export type AgentState = 'coding' | 'distracted' | 'panicking' | 'merge_conflict' | 'idle';
export type GamePhase = 'LOBBY' | 'HACKING' | 'GAME_OVER';
export type GameOutcome = 'WIN' | 'MERGE_CONFLICT' | 'COFFEE_ADDICTION' | 'TIMEOUT';

export interface Agent {
  id: string;
  userId: string;
  name: string;
  x: number;
  y: number;
  state: AgentState;
  commits: number;
  hasHeadphones: boolean;
  headphoneTicksLeft: number;
  speedMultiplier: number;
  lastActionTick: number;
  coffeeTime: number;
  forcePushCount: number;
  mergeConflictTicksLeft: number;
}

export interface GameEvent {
  agentId: string;
  agentName: string;
  action: string;
  detail: string;
  tick: number;
  timestamp: Date;
}

export interface HackathonGameState {
  id: string;
  phase: GamePhase;
  subPhase: 'NORMAL' | 'CRUNCH_TIME';
  tickCount: number;
  maxTicks: number;
  timeRemainingPercent: number;
  featureProgress: number;
  totalCommits: number;
  targetCommits: number;
  outcome: GameOutcome | null;
  grid: GridCell[][];
  agents: {
    id: string;
    name: string;
    x: number;
    y: number;
    state: AgentState;
    commits: number;
    hasHeadphones: boolean;
    coffeeTime: number;
    forcePushCount: number;
  }[];
  logs: string[];
  events: GameEvent[];
  currentActorName: string | null;
  currentActorState: string | null;
}
