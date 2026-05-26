'use client';

import { useState, useEffect } from 'react';

export default function Admin() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBookings() {
      try {
        const res = await fetch('/api/bookings');
        const data = await res.json();
        setBookings(data.bookings || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, []);

  const handleInitDb = async () => {
    try {
      await fetch('/api/init');
      alert('Database initialized. Refresh the page.');
    } catch (e) {
      alert('Error initializing database.');
    }
  };

  return (
    <main className="container mt-4 mb-8" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin Dashboard</h1>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleInitDb}>
          Init DB (if empty)
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Booked At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ padding: '2rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ padding: '2rem' }}>
                    No bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id}>
                    <td><span className="badge">{b.date_string}</span></td>
                    <td>{b.time_slot}</td>
                    <td style={{ fontWeight: 500 }}>{b.name}</td>
                    <td style={{ color: '#94a3b8' }}>{b.phone}</td>
                    <td style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
