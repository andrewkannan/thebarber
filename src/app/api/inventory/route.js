import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query('SELECT * FROM inventory ORDER BY name ASC');
    return NextResponse.json({ inventory: res.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ inventory: [], error: 'Database error' });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, price } = body;
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const res = await query(
      'INSERT INTO inventory (name, price) VALUES ($1, $2) RETURNING *',
      [name, price]
    );
    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    await query('DELETE FROM inventory WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
