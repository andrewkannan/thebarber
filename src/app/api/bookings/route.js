import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, date_string, time_slot } = body;

    if (!name || !phone || !date_string || !time_slot) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const res = await query(
      'INSERT INTO bookings (name, phone, date_string, time_slot) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, phone, date_string, time_slot]
    );

    return NextResponse.json({ success: true, booking: res.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // unique violation
      return NextResponse.json({ error: 'Time slot already booked' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await query('SELECT * FROM bookings ORDER BY date_string DESC, time_slot DESC');
    return NextResponse.json({ bookings: res.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ bookings: [], error: 'Database error' });
  }
}
