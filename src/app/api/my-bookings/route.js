import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

  try {
    // Return future bookings, but for simplicity we return all or we can just let frontend sort
    const res = await query('SELECT * FROM bookings WHERE phone = $1 ORDER BY date_string DESC, time_slot DESC', [phone]);
    return NextResponse.json({ bookings: res.rows });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const phone = searchParams.get('phone'); 

  if (!id || !phone) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  try {
    await query('DELETE FROM bookings WHERE id = $1 AND phone = $2', [id, phone]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
