import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { gameService } from '@/lib/gameService';

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const body = await req.json();
    const { state } = body;

    if (state && !['thinking', 'coding'].includes(state)) {
      return NextResponse.json({ error: 'state must be "thinking", "coding", or null' }, { status: 400 });
    }

    const user = await gameService.getUser(apiKey);
    if (!user || !user.current_game_id) {
      return NextResponse.json({ error: 'Not in a game' }, { status: 400 });
    }

    const supabase = getSupabase();
    await supabase.from('games').update({
      current_actor_name: state ? user.name : null,
      current_actor_state: state || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.current_game_id);

    return NextResponse.json({
      ok: true,
      message: state
        ? `${user.name} is now ${state}`
        : 'Thinking state cleared',
    });
  } catch (e) {
    console.error('thinking state update failed', e);
    return NextResponse.json({ error: 'Failed to update thinking state' }, { status: 500 });
  }
}
