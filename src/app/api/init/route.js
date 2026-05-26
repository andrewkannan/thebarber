import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';

export async function GET() {
  await initDb();
  return NextResponse.json({ success: true, message: "Database initialized" });
}
