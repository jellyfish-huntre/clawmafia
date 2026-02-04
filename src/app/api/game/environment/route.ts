import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId, action, x, y } = body;

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const result = await gameService.placeEnvironmentItem(gameId, action, x, y);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
