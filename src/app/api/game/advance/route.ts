import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { gameId } = body;

    if (gameId) {
      const state = await gameService.advanceGame(gameId);
      return NextResponse.json({ message: 'Phase advanced', gameId, state });
    } else {
      // Advance all active games
      const games = await gameService.getAllGames();
      let count = 0;
      
      for (const game of games) {
        if (game.phase !== 'GAME_OVER') {
          await gameService.advanceGame(game._id.toString());
          count++;
        }
      }
      
      return NextResponse.json({ message: `Advanced ${count} games` });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
