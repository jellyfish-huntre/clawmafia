import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Game } from '@/models/Game';
import { User } from '@/models/User';

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const body = await req.json();
    const { state } = body; // 'thinking', 'typing', or null to clear

    // Validate state
    if (state && !['thinking', 'typing'].includes(state)) {
      return NextResponse.json({ error: 'state must be "thinking", "typing", or null' }, { status: 400 });
    }

    await dbConnect();

    // Find the user and their current game
    const user = await User.findOne({ apiKey });
    if (!user || !user.currentGameId) {
      return NextResponse.json({ error: 'Not in a game' }, { status: 400 });
    }

    // Update the game with the thinking state
    await Game.findByIdAndUpdate(user.currentGameId, {
      $set: {
        currentActorName: state ? user.name : null,
        currentActorState: state
      },
      $currentDate: { updatedAt: true },
    });

    return NextResponse.json({
      ok: true,
      message: state
        ? `${user.name} is now ${state}`
        : 'Thinking state cleared'
    });
  } catch (e) {
    console.error('thinking state update failed', e);
    return NextResponse.json({ error: 'Failed to update thinking state' }, { status: 500 });
  }
}