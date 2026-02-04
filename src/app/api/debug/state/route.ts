import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function GET() {
  try {
    const games = await gameService.getAllGames();
    const lobbyCount = await gameService.getLobbyCount();

    return NextResponse.json({
      games,
      lobbyCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
