import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';
import { MafiaGame } from '@/lib/game';

export async function GET() {
  const gamesDocs = await gameService.getAllGames();
  const games = gamesDocs.map(doc => MafiaGame.fromData(doc).getState());
  
  const lobby = await gameService.getLobby();
  
  return NextResponse.json({
    games,
    lobbyCount: lobby.length
  });
}
