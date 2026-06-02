import { NextResponse } from 'next/server';
import { query, initDb } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, date_string, time_slot, reschedule } = body;

    if (!name || !phone || !date_string || !time_slot) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Check if phone already has a booking on this date
    const existingRes = await query('SELECT * FROM bookings WHERE phone = $1 AND date_string = $2', [phone, date_string]);
    
    if (existingRes.rows.length > 0) {
      const existingBooking = existingRes.rows[0];
      
      if (!reschedule) {
        return NextResponse.json({ 
          error: 'Already booked', 
          requiresReschedule: true, 
          oldSlot: existingBooking.time_slot 
        }, { status: 409 });
      } else {
        // Handle rescheduling
        const slotCheck = await query('SELECT * FROM bookings WHERE date_string = $1 AND time_slot = $2', [date_string, time_slot]);
        if (slotCheck.rows.length > 0 && slotCheck.rows[0].phone !== phone) {
           return NextResponse.json({ error: 'Time slot already booked by someone else' }, { status: 400 });
        }

        const updateRes = await query(
          'UPDATE bookings SET time_slot = $1, name = $2 WHERE id = $3 RETURNING *',
          [time_slot, name, existingBooking.id]
        );
        return NextResponse.json({ success: true, booking: updateRes.rows[0] });
      }
    }

    const res = await query(
      'INSERT INTO bookings (name, phone, date_string, time_slot) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, phone, date_string, time_slot]
    );

    return NextResponse.json({ success: true, booking: res.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') { // Postgres relation does not exist
      await initDb();
      return NextResponse.json({ error: 'Database was uninitialized. We just set it up for you! Please try booking again.' }, { status: 500 });
    }
    if (err.code === '23505') { 
      return NextResponse.json({ error: 'Time slot already booked' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await query(`
      SELECT b.*, 
             (SELECT COUNT(*) FROM bookings b2 WHERE b2.phone = b.phone) as total_bookings
      FROM bookings b 
      ORDER BY b.date_string DESC, b.time_slot DESC
    `);
    
    const bookingsWithNewFlag = res.rows.map(b => ({
      ...b,
      is_new: parseInt(b.total_bookings, 10) === 1
    }));

    return NextResponse.json({ bookings: bookingsWithNewFlag });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ bookings: [], error: 'Database error' });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status, total_price, billed_items } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    
    if (total_price !== undefined && billed_items !== undefined) {
      const res = await query(
        'UPDATE bookings SET status = $1, total_price = $2, billed_items = $3 WHERE id = $4 RETURNING *',
        [status, total_price, JSON.stringify(billed_items), id]
      );
      return NextResponse.json({ success: true, booking: res.rows[0] });
    } else {
      const res = await query(
        'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      return NextResponse.json({ success: true, booking: res.rows[0] });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
