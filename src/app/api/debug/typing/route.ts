import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { gameId, playerName, state } = body;
    if (!gameId) {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 });
    }

    if (state && !['thinking', 'coding'].includes(state)) {
      return NextResponse.json({ error: 'state must be "thinking" or "coding"' }, { status: 400 });
    }

    const supabase = getSupabase();
    await supabase.from('games').update({
      current_actor_name: playerName ?? null,
      current_actor_state: state ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('typing update failed', e);
    return NextResponse.json({ error: 'Failed to update typing' }, { status: 500 });
  }
}
