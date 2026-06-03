import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query('SELECT * FROM slot_overrides ORDER BY date_string DESC');
    return NextResponse.json({ overrides: res.rows });
  } catch (err) {
    return NextResponse.json({ overrides: [], error: 'Database error' });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date_string, time_slot, override_type } = body;
    if (!date_string || !time_slot || !override_type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Delete any existing override for this exact slot first to avoid duplicates
    await query('DELETE FROM slot_overrides WHERE date_string = $1 AND time_slot = $2', [date_string, time_slot]);

    const res = await query(
      'INSERT INTO slot_overrides (date_string, time_slot, override_type) VALUES ($1, $2, $3) RETURNING *',
      [date_string, time_slot, override_type]
    );
    return NextResponse.json({ success: true, override: res.rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const date = searchParams.get('date');
  const time = searchParams.get('time');

  try {
    if (id) {
      await query('DELETE FROM slot_overrides WHERE id = $1', [id]);
    } else if (date && time) {
      await query('DELETE FROM slot_overrides WHERE date_string = $1 AND time_slot = $2', [date, time]);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
