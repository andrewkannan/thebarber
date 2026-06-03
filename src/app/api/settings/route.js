import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const isPublic = url.searchParams.get('public') === 'true';

    const res = await query('SELECT * FROM settings');
    const settings = {};
    res.rows.forEach(row => {
      if (isPublic && row.key === 'wa_template') return;
      settings[row.key] = row.value;
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ settings: {}, error: 'Database error' });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Support bulk update
    if (body.settings && typeof body.settings === 'object') {
      for (const [key, value] of Object.entries(body.settings)) {
        await query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, value]
        );
      }
      return NextResponse.json({ success: true });
    }

    // Support single update (legacy)
    const { key, value } = body;
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
