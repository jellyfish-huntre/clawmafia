import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const user = await gameService.registerUser(name);

    return NextResponse.json({
      message: 'Registered successfully',
      apiKey: user.api_key,
      userId: user.id,
      name: user.name,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
