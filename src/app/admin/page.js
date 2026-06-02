'use client';

import { useState, useEffect } from 'react';

export default function Admin() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Overrides state
  const [overrides, setOverrides] = useState([]);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideTime, setOverrideTime] = useState('');
  const [overrideType, setOverrideType] = useState('ADDED');
  
  const [activeTab, setActiveTab] = useState('bookings');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [bRes, oRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/admin/overrides')
      ]);
      const bData = await bRes.json();
      const oData = await oRes.json();
      setBookings(bData.bookings || []);
      setOverrides(oData.overrides || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleInitDb = async () => {
    try {
      await fetch('/api/init');
      alert('Database initialized. Refresh the page.');
    } catch (e) {
      alert('Error initializing database.');
    }
  };

  const handleAddOverride = async (e) => {
    e.preventDefault();
    if (!overrideDate || !overrideTime) return;
    try {
      const res = await fetch('/api/admin/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_string: overrideDate, time_slot: overrideTime, override_type: overrideType })
      });
      if (res.ok) {
        setOverrideDate('');
        setOverrideTime('');
        fetchData();
      } else {
        alert('Failed to add slot');
      }
    } catch (err) {
      alert('Error');
    }
  };

  const handleDeleteOverride = async (id) => {
    if (!confirm('Delete this override?')) return;
    try {
      await fetch(`/api/admin/overrides?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {}
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        fetchData(); // refresh
      } else {
        alert('Failed to update status');
      }
    } catch (err) {
      alert('Error updating status');
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

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className="btn" 
          style={{ width: 'auto', background: activeTab === 'bookings' ? 'var(--primary)' : 'var(--secondary)' }}
          onClick={() => setActiveTab('bookings')}
        >
          Bookings
        </button>
        <button 
          className="btn" 
          style={{ width: 'auto', background: activeTab === 'overrides' ? 'var(--primary)' : 'var(--secondary)' }}
          onClick={() => setActiveTab('overrides')}
        >
          Manage Slots
        </button>
      </div>

      {activeTab === 'bookings' && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Status</th>
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
                    <td colSpan="6" className="text-center" style={{ padding: '2rem' }}>
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td><span className="badge">{b.date_string}</span></td>
                      <td>{b.time_slot}</td>
                      <td style={{ fontWeight: 500 }}>
                        {b.name}
                        {b.is_new && <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--success)', color: '#fff', fontSize: '0.65rem' }}>NEW</span>}
                      </td>
                      <td style={{ color: '#94a3b8' }}>{b.phone}</td>
                      <td>
                        <select 
                          className="form-input" 
                          style={{ padding: '0.25rem 0.5rem', width: 'auto', fontSize: '0.875rem' }}
                          value={b.status || 'PENDING'}
                          onChange={(e) => handleUpdateStatus(b.id, e.target.value)}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>
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
      )}

      {activeTab === 'overrides' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Add or Block a Slot</h2>
          <form onSubmit={handleAddOverride} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">Date (YYYY-MM-DD)</label>
              <input type="date" className="form-input" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">Time String (e.g. 10:15 AM)</label>
              <input type="text" className="form-input" value={overrideTime} onChange={e => setOverrideTime(e.target.value)} placeholder="10:15 AM" required />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">Action</label>
              <select className="form-input" value={overrideType} onChange={e => setOverrideType(e.target.value)}>
                <option value="ADDED">Add Custom Slot</option>
                <option value="BLOCKED">Block Time Slot</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto', height: '48px' }}>Save</button>
            </div>
          </form>

          <h3 style={{ marginBottom: '1rem' }}>Active Overrides</h3>
          {overrides.length === 0 ? <p style={{ color: '#94a3b8' }}>No overrides set.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {overrides.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--secondary)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                  <div>
                    <span className="badge" style={{ background: o.override_type === 'ADDED' ? 'rgba(56,189,248,0.1)' : 'rgba(239,68,68,0.1)', color: o.override_type === 'ADDED' ? 'var(--accent)' : 'var(--danger)', marginRight: '1rem' }}>{o.override_type}</span>
                    <strong>{o.date_string}</strong> at {o.time_slot}
                  </div>
                  <button className="btn" style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', width: 'auto', padding: '0.25rem 0.75rem' }} onClick={() => handleDeleteOverride(o.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
