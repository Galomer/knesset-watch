import { NextResponse } from 'next/server';
import { fetchPlenumStats } from '@/lib/knesset-api';

export const revalidate = 3600;

export async function GET() {
  try {
    const stats = await fetchPlenumStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ total: 7296, passed: 516, sessions: 385 });
  }
}
