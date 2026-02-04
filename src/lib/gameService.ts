import { getSupabase } from './supabase';
import { HackathonGame } from './game';
import { Agent } from './types';
import { randomUUID } from 'crypto';

export class GameService {
  async registerUser(name: string) {
    const supabase = getSupabase();
    const apiKey = randomUUID();

    const { data, error } = await supabase
      .from('users')
      .insert({ name, api_key: apiKey })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getUser(apiKey: string) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .single();
    return data;
  }

  async joinLobby(apiKey: string) {
    const supabase = getSupabase();
    const user = await this.getUser(apiKey);
    if (!user) throw new Error('Invalid API Key');

    if (user.current_game_id) {
      const { data: game } = await supabase
        .from('games')
        .select('phase')
        .eq('id', user.current_game_id)
        .single();

      if (game && game.phase !== 'GAME_OVER') {
        return { message: 'Already in an active game', gameId: user.current_game_id };
      }

      await supabase.from('users').update({ current_game_id: null }).eq('id', user.id);
    }

    const { data: existingLobby } = await supabase
      .from('lobby')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingLobby) {
      return this.tryCreateMatch();
    }

    await supabase.from('lobby').insert({ user_id: user.id, name: user.name });
    return this.tryCreateMatch();
  }

  private async tryCreateMatch() {
    const supabase = getSupabase();
    const { data: lobbyPlayers } = await supabase
      .from('lobby')
      .select('*')
      .order('joined_at', { ascending: true })
      .limit(6);

    if (!lobbyPlayers || lobbyPlayers.length < 3) {
      return { message: 'Waiting for players', queueSize: lobbyPlayers?.length || 0 };
    }

    const players = lobbyPlayers.slice(0, 6);

    const gameLogic = new HackathonGame('temp');
    players.forEach(p => gameLogic.addAgent({ id: p.user_id, name: p.name }));
    gameLogic.startGame();

    const gameData = gameLogic.toData();
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert(gameData)
      .select('id')
      .single();

    if (gameError) throw new Error(gameError.message);
    const gameId = game.id;

    const agentRows = gameLogic.agents.map(a => ({
      game_id: gameId,
      user_id: a.userId,
      name: a.name,
      x: a.x,
      y: a.y,
      state: a.state,
      commits: a.commits,
      has_headphones: a.hasHeadphones,
      speed_multiplier: a.speedMultiplier,
      last_action_tick: a.lastActionTick,
      coffee_time: a.coffeeTime,
      force_push_count: a.forcePushCount,
    }));

    await supabase.from('game_agents').insert(agentRows);

    const userIds = players.map(p => p.user_id);
    await supabase.from('users').update({ current_game_id: gameId }).in('id', userIds);
    await supabase.from('lobby').delete().in('user_id', userIds);

    return { message: 'Game started', gameId };
  }

  async getGameStatus(apiKey: string) {
    const supabase = getSupabase();
    const user = await this.getUser(apiKey);
    if (!user || !user.current_game_id) return null;

    const { data: gameDoc } = await supabase
      .from('games')
      .select('*')
      .eq('id', user.current_game_id)
      .single();

    if (!gameDoc) return null;

    const { data: agents } = await supabase
      .from('game_agents')
      .select('*')
      .eq('game_id', gameDoc.id);

    const gameLogic = HackathonGame.fromData(gameDoc);
    gameLogic.agents = (agents || []).map(this.dbAgentToAgent);

    return gameLogic.getState();
  }

  async performAction(apiKey: string, action: string, params?: { x?: number; y?: number }) {
    const supabase = getSupabase();
    const user = await this.getUser(apiKey);
    if (!user || !user.current_game_id) throw new Error('Not in a game');

    const { data: gameDoc } = await supabase
      .from('games')
      .select('*')
      .eq('id', user.current_game_id)
      .single();

    if (!gameDoc) throw new Error('Game not found');

    const { data: agents } = await supabase
      .from('game_agents')
      .select('*')
      .eq('game_id', gameDoc.id);

    const gameLogic = HackathonGame.fromData(gameDoc);
    gameLogic.agents = (agents || []).map(this.dbAgentToAgent);

    const result = gameLogic.performAction(user.id, action, params);

    await supabase.from('games').update({
      ...gameLogic.toData(),
      current_actor_name: null,
      current_actor_state: null,
    }).eq('id', gameDoc.id);

    const updatedAgent = gameLogic.agents.find(a => a.userId === user.id);
    if (updatedAgent) {
      await supabase.from('game_agents').update({
        x: updatedAgent.x,
        y: updatedAgent.y,
        state: updatedAgent.state,
        commits: updatedAgent.commits,
        has_headphones: updatedAgent.hasHeadphones,
        coffee_time: updatedAgent.coffeeTime,
        force_push_count: updatedAgent.forcePushCount,
        last_action_tick: updatedAgent.lastActionTick,
      }).eq('game_id', gameDoc.id).eq('user_id', user.id);
    }

    return { message: result, state: gameLogic.getState() };
  }

  async advanceTick(gameId: string) {
    const supabase = getSupabase();
    const { data: gameDoc } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!gameDoc) throw new Error('Game not found');

    const { data: agents } = await supabase
      .from('game_agents')
      .select('*')
      .eq('game_id', gameId);

    const gameLogic = HackathonGame.fromData(gameDoc);
    gameLogic.agents = (agents || []).map(this.dbAgentToAgent);

    gameLogic.advanceTick();

    await supabase.from('games').update(gameLogic.toData()).eq('id', gameId);

    for (const agent of gameLogic.agents) {
      await supabase.from('game_agents').update({
        x: agent.x,
        y: agent.y,
        state: agent.state,
        commits: agent.commits,
        has_headphones: agent.hasHeadphones,
        speed_multiplier: agent.speedMultiplier,
        coffee_time: agent.coffeeTime,
        force_push_count: agent.forcePushCount,
        last_action_tick: agent.lastActionTick,
      }).eq('game_id', gameId).eq('user_id', agent.userId);
    }

    if (gameLogic.phase === 'GAME_OVER') {
      const userIds = gameLogic.agents.map(a => a.userId);
      await supabase.from('users').update({ current_game_id: null }).in('id', userIds);
    }

    return gameLogic.getState();
  }

  async placeEnvironmentItem(gameId: string, action: string, x?: number, y?: number) {
    const supabase = getSupabase();
    const { data: gameDoc } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!gameDoc) throw new Error('Game not found');

    const gameLogic = HackathonGame.fromData(gameDoc);
    const result = gameLogic.placeEnvironmentItem(action, x, y);

    await supabase.from('games').update(gameLogic.toData()).eq('id', gameId);

    return { message: result, state: gameLogic.getState() };
  }

  async getAllGames() {
    const supabase = getSupabase();
    const { data: gameDocs } = await supabase
      .from('games')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!gameDocs) return [];

    const results = [];
    for (const doc of gameDocs) {
      const { data: agents } = await supabase
        .from('game_agents')
        .select('*')
        .eq('game_id', doc.id);

      const gameLogic = HackathonGame.fromData(doc);
      gameLogic.agents = (agents || []).map(this.dbAgentToAgent);
      const state = gameLogic.getState();
      results.push(state);
    }

    return results;
  }

  async getLobbyCount() {
    const supabase = getSupabase();
    const { count } = await supabase
      .from('lobby')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async reset() {
    const supabase = getSupabase();
    await supabase.from('game_agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('lobby').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('games').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  private dbAgentToAgent(row: any): Agent {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      x: row.x,
      y: row.y,
      state: row.state,
      commits: row.commits,
      hasHeadphones: row.has_headphones,
      headphoneTicksLeft: 0,
      speedMultiplier: row.speed_multiplier,
      lastActionTick: row.last_action_tick,
      coffeeTime: row.coffee_time,
      forcePushCount: row.force_push_count,
      mergeConflictTicksLeft: row.state === 'merge_conflict' ? 5 : 0,
    };
  }
}

export const gameService = new GameService();
