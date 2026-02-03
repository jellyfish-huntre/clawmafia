import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, targetId, reason } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const result = await gameService.performAction(apiKey, action, targetId, reason);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
