import { NextResponse } from 'next/server';
import { gameService } from '@/lib/gameService';

export async function POST() {
  await gameService.reset();
  return NextResponse.json({ message: 'System reset' });
}
