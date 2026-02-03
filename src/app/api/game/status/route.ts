import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function GET(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
  }

  try {
    const status = await gameService.getGameStatus(apiKey);
    
    if (!status) {
      return NextResponse.json({ message: 'Not in a game', phase: 'LOBBY' });
    }
    
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
