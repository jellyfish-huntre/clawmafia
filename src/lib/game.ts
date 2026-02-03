export type Role = 'MAFIA' | 'VILLAGER' | 'DOCTOR' | 'DETECTIVE';
export type Phase = 'LOBBY' | 'DAY' | 'NIGHT' | 'GAME_OVER';

export interface Player {
  id: string; // This will match the User ID
  name: string;
  role: Role | null;
  isAlive: boolean;
}

export interface GameState {
  id: string;
  phase: Phase;
  players: Player[];
  dayCount: number;
  winner: 'MAFIA' | 'VILLAGERS' | null;
  logs: string[];
  actions: any[]; // Expose detailed actions
}

export class MafiaGame {
  public id: string;
  public players: Player[] = [];
  public phase: Phase = 'LOBBY';
  public dayCount: number = 0;
  public winner: 'MAFIA' | 'VILLAGERS' | null = null;
  public logs: string[] = [];
  public actions: any[] = []; // Store detailed action history for dashboard

  // Night actions
  private mafiaTarget: string | null = null;
  private doctorTarget: string | null = null;
  private detectiveTarget: string | null = null;
  
  // Day votes
  private votes: Record<string, string> = {}; // voterId -> targetId

  // Hydrate from DB document
  static fromData(data: any): MafiaGame {
    const game = new MafiaGame(data._id.toString());
    game.phase = data.phase;
    game.players = data.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isAlive: p.isAlive
    }));
    game.dayCount = data.dayCount;
    game.winner = data.winner;
    game.logs = data.logs || [];
    game.actions = data.actions || [];
    game.mafiaTarget = data.mafiaTarget;
    game.doctorTarget = data.doctorTarget;
    game.detectiveTarget = data.detectiveTarget;
    game.votes = data.votes instanceof Map ? Object.fromEntries(data.votes) : (data.votes || {});
    return game;
  }

  // Export to simple object for DB save
  toData() {
    return {
      phase: this.phase,
      players: this.players,
      dayCount: this.dayCount,
      winner: this.winner,
      logs: this.logs,
      actions: this.actions,
      mafiaTarget: this.mafiaTarget,
      doctorTarget: this.doctorTarget,
      detectiveTarget: this.detectiveTarget,
      votes: this.votes
    };
  }

  constructor(id: string) {
    this.id = id;
  }

  getState(): GameState {
    return {
      id: this.id,
      phase: this.phase,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        role: this.phase === 'GAME_OVER' ? p.role : null, 
        isAlive: p.isAlive
      })),
      dayCount: this.dayCount,
      winner: this.winner,
      logs: this.logs,
      actions: this.actions
    };
  }

  getPlayer(id: string) {
    return this.players.find(p => p.id === id);
  }

  private logSystemAction(message: string) {
    this.logs.push(message);
    this.actions.push({
      playerId: 'SYSTEM',
      playerName: 'SYSTEM',
      action: 'SYSTEM',
      targetId: null,
      reason: message,
      phase: this.phase,
      day: this.dayCount,
      timestamp: new Date()
    });
  }

  addPlayer(user: { id: string; name: string }): Player {
    if (this.phase !== 'LOBBY') throw new Error('Game already started');
    if (this.players.find(p => p.id === user.id)) throw new Error('Player already in game');
    
    const player: Player = { 
      id: user.id, 
      name: user.name, 
      role: null, 
      isAlive: true 
    };
    this.players.push(player);
    this.logs.push(`${user.name} joined the game.`);
    return player;
  }

  startGame() {
    if (this.players.length < 3) throw new Error('Not enough players (min 3)');
    this.phase = 'NIGHT';
    this.dayCount = 1;
    this.assignRoles();
    this.logSystemAction('Game started! It is now Night 1.');
  }

  private assignRoles() {
    const shuffled = [...this.players].sort(() => 0.5 - Math.random());
    const count = this.players.length;
    let mafiaCount = Math.max(1, Math.floor(count / 4));
    
    for (let i = 0; i < count; i++) {
      if (i < mafiaCount) shuffled[i].role = 'MAFIA';
      else if (i === mafiaCount) shuffled[i].role = 'DOCTOR';
      else if (i === mafiaCount + 1) shuffled[i].role = 'DETECTIVE';
      else shuffled[i].role = 'VILLAGER';
    }
    this.players = shuffled;
  }

  performAction(playerId: string, action: string, targetId?: string, reason?: string): string {
    const player = this.getPlayer(playerId);
    if (!player) throw new Error('Player not found');
    if (!player.isAlive) throw new Error('Dead players cannot act');

    // Log the reasoning
    if (reason) {
      this.actions.push({
        playerId,
        playerName: player.name,
        action,
        targetId,
        reason,
        phase: this.phase,
        day: this.dayCount,
        timestamp: new Date()
      });
    }

    if (this.phase === 'NIGHT') {
      return this.handleNightAction(player, action, targetId);
    } else if (this.phase === 'DAY') {
      return this.handleDayAction(player, action, targetId);
    }
    
    throw new Error('Invalid phase for actions');
  }

  private handleNightAction(player: Player, action: string, targetId?: string): string {
    if (!targetId) throw new Error('Target required');
    
    if (player.role === 'MAFIA' && action === 'kill') {
      this.mafiaTarget = targetId;
      return 'Mafia target set';
    }
    if (player.role === 'DOCTOR' && action === 'heal') {
      this.doctorTarget = targetId;
      return 'Doctor target set';
    }
    if (player.role === 'DETECTIVE' && action === 'check') {
      const target = this.getPlayer(targetId);
      if (!target) throw new Error('Target not found');
      return target.role === 'MAFIA' ? 'Target is MAFIA' : 'Target is NOT Mafia';
    }
    
    throw new Error('Invalid night action for role');
  }

  private handleDayAction(player: Player, action: string, targetId?: string): string {
    if (action === 'vote') {
      if (!targetId) throw new Error('Vote target required');
      this.votes[player.id] = targetId;
      return 'Vote cast';
    }
    throw new Error('Invalid day action');
  }

  advancePhase() {
    if (this.phase === 'NIGHT') {
      this.processNight();
    } else if (this.phase === 'DAY') {
      this.processDay();
    }
  }

  private processNight() {
    this.logSystemAction(`Night ${this.dayCount} ended.`);
    
    let victimId = this.mafiaTarget;
    if (victimId && victimId === this.doctorTarget) {
      victimId = null; 
      this.logSystemAction('Someone was attacked but saved!');
    } else if (victimId) {
      const victim = this.getPlayer(victimId);
      if (victim) {
        victim.isAlive = false;
        this.logSystemAction(`${victim.name} was killed in the night.`);
      }
    } else {
      this.logSystemAction('No one died last night.');
    }

    this.mafiaTarget = null;
    this.doctorTarget = null;
    this.detectiveTarget = null;

    this.checkWinCondition();
    if (this.phase !== 'GAME_OVER') {
      this.phase = 'DAY';
    }
  }

  private processDay() {
    const voteCounts: Record<string, number> = {};
    Object.values(this.votes).forEach(targetId => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let eliminatedId: string | null = null;
    
    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = targetId;
      } else if (count === maxVotes) {
        eliminatedId = null; 
      }
    }

    if (eliminatedId) {
      const victim = this.getPlayer(eliminatedId);
      if (victim) {
        victim.isAlive = false;
        this.logSystemAction(`${victim.name} was voted out. They were ${victim.role}.`);
      }
    } else {
      this.logSystemAction('No one was voted out (tie or no votes).');
    }

    this.votes = {}; 
    this.checkWinCondition();
    if (this.phase !== 'GAME_OVER') {
      this.phase = 'NIGHT';
      this.dayCount++;
      this.logSystemAction(`Night ${this.dayCount} begins.`);
    }
  }

  private checkWinCondition() {
    const aliveMafia = this.players.filter(p => p.isAlive && p.role === 'MAFIA').length;
    const aliveVillagers = this.players.filter(p => p.isAlive && p.role !== 'MAFIA').length;

    if (aliveMafia === 0) {
      this.phase = 'GAME_OVER';
      this.winner = 'VILLAGERS';
      this.logSystemAction('Villagers win!');
    } else if (aliveMafia >= aliveVillagers) {
      this.phase = 'GAME_OVER';
      this.winner = 'MAFIA';
      this.logSystemAction('Mafia wins!');
    }
  }
}
