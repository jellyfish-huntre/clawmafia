import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Game } from '@/models/Game';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { gameId, playerName, state } = body;
    if (!gameId) {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 });
    }

    // Validate state if provided
    if (state && !['thinking', 'typing'].includes(state)) {
      return NextResponse.json({ error: 'state must be "thinking" or "typing"' }, { status: 400 });
    }

    await dbConnect();
    await Game.findByIdAndUpdate(gameId, {
      $set: {
        currentActorName: playerName ?? null,
        currentActorState: state ?? null
      },
      $currentDate: { updatedAt: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('typing update failed', e);
    return NextResponse.json({ error: 'Failed to update typing' }, { status: 500 });
  }
}
