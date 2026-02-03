import dbConnect from '@/lib/db';
import { User } from '@/models/User';
import { Game, IGame } from '@/models/Game';
import { Lobby } from '@/models/Lobby';
import { MafiaGame } from '@/lib/game';
import { randomUUID } from 'crypto';

export class GameService {
  async registerUser(name: string) {
    await dbConnect();
    const apiKey = randomUUID();
    const user = await User.create({
      apiKey,
      name,
    });
    return user;
  }

  async getUser(apiKey: string) {
    await dbConnect();
    return User.findOne({ apiKey });
  }

  async joinLobby(apiKey: string) {
    await dbConnect();
    const user = await User.findOne({ apiKey });
    if (!user) throw new Error('Invalid API Key');

    if (user.currentGameId) {
       // Check if game is still active
       const activeGame = await Game.findById(user.currentGameId);
       if (activeGame && activeGame.phase !== 'GAME_OVER') {
         return { message: 'Already in an active game', gameId: user.currentGameId };
       }
       // If game over, clear it
       user.currentGameId = undefined;
       await user.save();
    }

    // Check if already in lobby
    const existingLobby = await Lobby.findOne({ userId: apiKey });
    if (existingLobby) {
      // Even if already in lobby, check if we can start a match (e.g. if we were waiting)
      return this.tryCreateMatch();
    }

    await Lobby.create({
      userId: apiKey,
      name: user.name
    });

    // Check for match
    console.log(`Checking match for ${user.name}...`);
    return this.tryCreateMatch();
  }

  private async tryCreateMatch() {
    // Transaction ideally, but keeping it simple for now
    const lobbyPlayers = await Lobby.find().sort({ joinedAt: 1 }).limit(4);
    console.log(`Lobby size: ${lobbyPlayers.length}`);
    
    if (lobbyPlayers.length >= 4) {
      console.log('Starting match!');
      const players = lobbyPlayers.map(p => ({
        id: p.userId,
        name: p.name
      }));

      // Create Game
      const gameLogic = new MafiaGame('temp'); // ID will be assigned by Mongo
      players.forEach(p => gameLogic.addPlayer(p));
      gameLogic.startGame();

      const gameData = gameLogic.toData();
      const game = await Game.create(gameData);
      
      // Update Users and remove from Lobby
      const userIds = players.map(p => p.id);
      
      await User.updateMany(
        { apiKey: { $in: userIds } },
        { $set: { currentGameId: game._id.toString() } }
      );

      await Lobby.deleteMany({ userId: { $in: userIds } });

      return { message: 'Game started', gameId: game._id };
    }

    return { message: 'Waiting for players', queueSize: lobbyPlayers.length };
  }

  async getGameStatus(apiKey: string) {
    await dbConnect();
    const user = await User.findOne({ apiKey });
    if (!user || !user.currentGameId) return null;

    const gameDoc = await Game.findById(user.currentGameId);
    if (!gameDoc) return null;

    const gameLogic = MafiaGame.fromData(gameDoc);
    // Return state customized for the player (hide roles etc)
    const state = gameLogic.getState();
    
    // Reveal own role to the player
    const myPlayer = state.players.find(p => p.id === apiKey);
    if (myPlayer) {
      // We need to get the real role from the game logic players list, not the sanitized state
      const realPlayer = gameLogic.players.find(p => p.id === apiKey);
      if (realPlayer) {
         myPlayer.role = realPlayer.role;
      }
    }
    
    return state;
  }

  async performAction(apiKey: string, action: string, targetId?: string, reason?: string) {
    await dbConnect();
    const user = await User.findOne({ apiKey });
    if (!user || !user.currentGameId) throw new Error('Not in a game');

    const gameDoc = await Game.findById(user.currentGameId);
    if (!gameDoc) throw new Error('Game not found');

    const gameLogic = MafiaGame.fromData(gameDoc);
    const result = gameLogic.performAction(apiKey, action, targetId, reason);

    // Save back
    const updateData = gameLogic.toData();
    Object.assign(gameDoc, updateData);
    gameDoc.markModified('votes'); // Map needs explicit markModified sometimes, or if we replaced the object it might be fine
    gameDoc.markModified('actions'); // Explicitly mark actions modified
    await gameDoc.save();

    return { message: result, state: gameLogic.getState() };
  }

  async advanceGame(gameId: string) {
    await dbConnect();
    const gameDoc = await Game.findById(gameId);
    if (!gameDoc) throw new Error('Game not found');

    const gameLogic = MafiaGame.fromData(gameDoc);
    gameLogic.advancePhase();

    const updateData = gameLogic.toData();
    Object.assign(gameDoc, updateData);
    gameDoc.markModified('votes');
    await gameDoc.save();

    return gameLogic.getState();
  }
  
  async getAllGames() {
      await dbConnect();
      return Game.find({ phase: { $ne: 'GAME_OVER' } });
  }
  
  async getLobby() {
    await dbConnect();
    return Lobby.find();
  }

  async reset() {
    await dbConnect();
    await Game.deleteMany({});
    await Lobby.deleteMany({});
    await User.deleteMany({});
  }
}

export const gameService = new GameService();
