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
    const res = await query('SELECT time_slot FROM bookings WHERE date_string = $1', [date]);
    const bookedSlots = res.rows.map(row => row.time_slot);
    const availableSlots = ALL_SLOTS.filter(slot => !bookedSlots.includes(slot));
    return NextResponse.json({ availableSlots });
  } catch (err) {
    console.error(err);
    // Return all slots if table doesn't exist yet, or fail
    return NextResponse.json({ availableSlots: ALL_SLOTS, error: err.message });
  }
}
