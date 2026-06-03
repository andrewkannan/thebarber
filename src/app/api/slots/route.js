import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ALL_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  try {
    // Determine day of the week
    const d = new Date(date);
    const dayOfWeek = d.getDay().toString(); // 0 (Sun) to 6 (Sat)
    
    // Fetch base slots for this day from settings
    let baseSlots = ALL_SLOTS;
    try {
      const sRes = await query("SELECT value FROM settings WHERE key = 'weekly_schedule'");
      if (sRes.rows.length > 0) {
        const schedule = JSON.parse(sRes.rows[0].value);
        if (schedule && schedule[dayOfWeek]) {
          baseSlots = schedule[dayOfWeek];
        } else {
          baseSlots = []; // If weekly schedule exists but day is empty, default to no slots
        }
      }
    } catch (e) {
      // settings or json parse error, ignore and use legacy
    }

    const res = await query('SELECT time_slot FROM bookings WHERE date_string = $1', [date]);
    const bookedSlots = res.rows.map(row => row.time_slot);

    let blockedSlots = [];
    let addedSlots = [];

    try {
      const overrideRes = await query('SELECT time_slot, override_type FROM slot_overrides WHERE date_string = $1', [date]);
      blockedSlots = overrideRes.rows.filter(r => r.override_type === 'BLOCKED').map(r => r.time_slot);
      addedSlots = overrideRes.rows.filter(r => r.override_type === 'ADDED').map(r => r.time_slot);
    } catch(e) {
      // overrides table might not exist yet if not initialized, ignore safely
    }

    let finalSlots = [...new Set([...baseSlots, ...addedSlots])];
    
    // Sort chronologically
    finalSlots.sort((a, b) => {
      const parseTime = (t) => {
        const [time, period] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      return parseTime(a) - parseTime(b);
    });

    const unavailable = new Set([...bookedSlots, ...blockedSlots]);
    const availableSlots = finalSlots.filter(slot => !unavailable.has(slot));

    return NextResponse.json({ availableSlots });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ availableSlots: ALL_SLOTS, error: err.message });
  }
}
