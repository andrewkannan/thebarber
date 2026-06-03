'use client';

import { useState, useEffect, useMemo } from 'react';

const generateDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      dateObj: d,
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      num: i === 0 ? 'Today' : d.getDate(),
      fullString: d.toISOString().split('T')[0]
    });
  }
  return dates;
};

export default function Admin() {
  const [dates] = useState(generateDates());
  const [selectedDate, setSelectedDate] = useState(dates[0].fullString);

  const [bookings, setBookings] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);

  // Overrides state
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideTime, setOverrideTime] = useState('');
  const [overrideType, setOverrideType] = useState('ADDED');
  
  // Inventory state
  const [invName, setInvName] = useState('');
  const [invPrice, setInvPrice] = useState('');

  // Billing Modal state
  const [billingBooking, setBillingBooking] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});

  // Settings state
  const [waTemplate, setWaTemplate] = useState('Hi #name, your slot on #date at #time is confirmed! See you then.');
  const [wazeUrl, setWazeUrl] = useState('');
  const [gmapUrl, setGmapUrl] = useState('');
  const [phoneLink, setPhoneLink] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Edit Booking state
  const [editingBooking, setEditingBooking] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', date_string: '', time_slot: '' });
  const [editConflict, setEditConflict] = useState(null);

  const [activeTab, setActiveTab] = useState('bookings');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [bRes, oRes, iRes, sRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/admin/overrides'),
        fetch('/api/inventory'),
        fetch('/api/settings')
      ]);
      const bData = await bRes.json();
      const oData = await oRes.json();
      const iData = await iRes.json();
      const sData = await sRes.json();
      setBookings(bData.bookings || []);
      setOverrides(oData.overrides || []);
      setInventory(iData.inventory || []);
      if (sData.settings) {
        if (sData.settings.wa_template) setWaTemplate(sData.settings.wa_template);
        if (sData.settings.waze_url) setWazeUrl(sData.settings.waze_url);
        if (sData.settings.gmap_url) setGmapUrl(sData.settings.gmap_url);
        if (sData.settings.phone_link) setPhoneLink(sData.settings.phone_link);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const todaysBookings = useMemo(() => {
    // Backend sorts by date desc, time desc. We'll reverse it so earliest time is first.
    const daily = bookings.filter(b => b.date_string === selectedDate).reverse();
    const active = daily.filter(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED');
    const inactive = daily.filter(b => b.status === 'COMPLETED' || b.status === 'CANCELLED');
    return [...active, ...inactive];
  }, [bookings, selectedDate]);

  const dailyRevenue = useMemo(() => {
    return todaysBookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);
  }, [todaysBookings]);

  const handleInitDb = async () => {
    try {
      await fetch('/api/init');
      alert('Database initialized. Refresh the page.');
    } catch (e) {
      alert('Error initializing database.');
    }
  };

  const handleUpdateStatus = async (id, newStatus, extraData = {}) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, ...extraData })
      });
      if (res.ok) fetchData();
      else alert('Failed to update status');
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleConfirmBooking = async (b) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, status: 'CONFIRMED' })
      });
      if (res.ok) {
        fetchData();
        let msg = waTemplate;
        msg = msg.replace(/#name/g, b.name);
        msg = msg.replace(/#date/g, b.date_string);
        msg = msg.replace(/#time/g, b.time_slot);
        
        const cleanPhone = b.phone.replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
      } else {
        alert('Failed to confirm booking');
      }
    } catch (err) {
      alert('Error confirming booking');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.phone || !editForm.date_string || !editForm.time_slot) return;
    
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBooking.id,
          ...editForm
        })
      });
      const data = await res.json();
      if (res.status === 409 && data.requiresReschedule) {
        setEditConflict(data.suggestedSlot);
      } else if (res.ok) {
        setEditingBooking(null);
        fetchData();
      } else {
        alert(data.error || 'Failed to update booking');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleAddInventory = async (e) => {
    e.preventDefault();
    if (!invName || !invPrice) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: invName, price: parseFloat(invPrice) })
      });
      if (res.ok) {
        setInvName(''); setInvPrice(''); fetchData();
      }
    } catch (err) {}
  };

  const handleDeleteInventory = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {}
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
        setOverrideDate(''); setOverrideTime(''); fetchData();
      }
    } catch (err) {}
  };

  const handleDeleteOverride = async (id) => {
    if (!confirm('Delete this override?')) return;
    try {
      await fetch(`/api/admin/overrides?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {}
  };

  const submitBill = async () => {
    const billed_items = [];
    let total_price = 0;
    inventory.forEach(item => {
      if (selectedItems[item.id]) {
        billed_items.push(item);
        total_price += parseFloat(item.price);
      }
    });

    await handleUpdateStatus(billingBooking.id, 'COMPLETED', { total_price, billed_items });
    setBillingBooking(null);
  };

  return (
    <main className="container mt-4 mb-8" style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Admin Dashboard</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }} className="hide-scrollbar">
        <button 
          className="btn" 
          style={{ width: 'auto', background: activeTab === 'bookings' ? 'var(--primary)' : 'var(--secondary)', whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
          onClick={() => setActiveTab('bookings')}
        >
          Bookings
        </button>
        <button 
          className="btn" 
          style={{ width: 'auto', background: activeTab === 'inventory' ? 'var(--primary)' : 'var(--secondary)', whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button 
          className="btn" 
          style={{ width: 'auto', background: activeTab === 'overrides' ? 'var(--primary)' : 'var(--secondary)', whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
          onClick={() => setActiveTab('overrides')}
        >
          Slots
        </button>
        <button 
          className="btn" 
          style={{ width: 'auto', background: activeTab === 'settings' ? 'var(--primary)' : 'var(--secondary)', whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'bookings' && (
        <>
          <div className="date-selector hide-scrollbar" style={{ marginBottom: '1.5rem' }}>
            {dates.map((d, i) => (
              <button
                key={i}
                className={`date-btn ${selectedDate === d.fullString ? 'active' : ''}`}
                onClick={() => setSelectedDate(d.fullString)}
              >
                <span className="date-day">{d.day}</span>
                <span className="date-num" style={d.num === 'Today' ? { fontSize: '1rem' } : {}}>{d.num}</span>
              </button>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--accent)' }}>
            <div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Revenue</p>
              <h2 style={{ margin: 0, color: 'var(--accent)' }}>RM {dailyRevenue.toFixed(2)}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>{todaysBookings.filter(b => b.status === 'COMPLETED').length} Completed</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center" style={{ padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : todaysBookings.length === 0 ? (
            <p className="text-center" style={{ color: '#94a3b8' }}>No bookings for this date.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {todaysBookings.map((b) => (
                <div key={b.id} className="glass-panel" style={{ padding: '1.25rem', opacity: (b.status === 'COMPLETED' || b.status === 'CANCELLED') ? 0.6 : 1, filter: (b.status === 'COMPLETED' || b.status === 'CANCELLED') ? 'grayscale(100%)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {b.time_slot}
                        {b.is_new && <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--success)', color: '#fff' }}>NEW</span>}
                      </h3>
                      <p style={{ margin: 0, fontWeight: '500' }}>{b.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{b.phone}</p>
                        <a 
                          href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="badge"
                          style={{ background: '#25D366', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                        >
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51h-.57c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </a>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          onClick={() => {
                            setEditingBooking(b);
                            setEditForm({ name: b.name, phone: b.phone, date_string: b.date_string, time_slot: b.time_slot });
                            setEditConflict(null);
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                          title="Edit Booking"
                        >
                          ✏️
                        </button>
                        <span className="badge" style={{ 
                          fontSize: '0.75rem', 
                          background: b.status === 'PENDING' ? 'rgba(234, 179, 8, 0.1)' : 
                                     b.status === 'CONFIRMED' ? 'rgba(56, 189, 248, 0.1)' :
                                     b.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.1)' :
                                     'rgba(239, 68, 68, 0.1)',
                          color: b.status === 'PENDING' ? '#eab308' :
                                 b.status === 'CONFIRMED' ? '#38bdf8' :
                                 b.status === 'COMPLETED' ? '#22c55e' :
                                 '#ef4444',
                          fontWeight: 'bold',
                          letterSpacing: '0.05em'
                        }}>
                          {b.status || 'PENDING'}
                        </span>
                      </div>
                      {b.status === 'COMPLETED' && b.total_price && (
                        <span style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          RM {parseFloat(b.total_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {b.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleConfirmBooking(b)}>Confirm</button>
                      <button className="btn" style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }} onClick={() => handleUpdateStatus(b.id, 'CANCELLED')}>Cancel</button>
                    </div>
                  )}

                  {b.status === 'CONFIRMED' && (
                    <button className="btn" style={{ width: '100%', padding: '0.5rem', background: 'var(--accent)', color: '#fff' }} onClick={() => openBillingModal(b)}>
                      Payment
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'inventory' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Inventory</h2>
          <form onSubmit={handleAddInventory} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ flex: 2 }}>
              <input type="text" className="form-input" placeholder="Service Name" value={invName} onChange={e => setInvName(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <input type="number" step="0.01" className="form-input" placeholder="Price" value={invPrice} onChange={e => setInvPrice(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 1rem' }}>Add</button>
          </form>

          {inventory.length === 0 ? <p style={{ color: '#94a3b8' }}>No items in inventory.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {inventory.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)' }}>
                  <span>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <strong>RM {parseFloat(item.price).toFixed(2)}</strong>
                    <button onClick={() => handleDeleteInventory(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.25rem' }}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Add or Block a Slot</h2>
          <form onSubmit={handleAddOverride} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label className="form-label">Date (YYYY-MM-DD)</label>
              <input type="date" className="form-input" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Time String (e.g. 10:15 AM)</label>
              <input type="text" className="form-input" value={overrideTime} onChange={e => setOverrideTime(e.target.value)} placeholder="10:15 AM" required />
            </div>
            <div>
              <label className="form-label">Action</label>
              <select className="form-input" value={overrideType} onChange={e => setOverrideType(e.target.value)}>
                <option value="ADDED">Add Custom Slot</option>
                <option value="BLOCKED">Block Time Slot</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Save</button>
          </form>

          <h3 style={{ marginBottom: '1rem' }}>Active Overrides</h3>
          {overrides.length === 0 ? <p style={{ color: '#94a3b8' }}>No overrides set.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {overrides.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span className="badge" style={{ background: o.override_type === 'ADDED' ? 'rgba(56,189,248,0.1)' : 'rgba(239,68,68,0.1)', color: o.override_type === 'ADDED' ? 'var(--accent)' : 'var(--danger)', marginRight: '0.5rem' }}>{o.override_type}</span>
                    <strong>{o.date_string}</strong> {o.time_slot}
                  </div>
                  <button className="btn" style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleDeleteOverride(o.id)}>Del</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>WhatsApp Template</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Customize the message sent when you confirm a booking. Available tags: <strong>#name</strong>, <strong>#date</strong>, <strong>#time</strong>
          </p>
          <textarea 
            className="form-input" 
            rows="4"
            value={waTemplate}
            onChange={(e) => setWaTemplate(e.target.value)}
            style={{ marginBottom: '1rem', resize: 'vertical' }}
          />
          <button 
            className="btn btn-primary" 
            onClick={async () => {
              setIsSavingSettings(true);
              try {
                await fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    settings: {
                      wa_template: waTemplate,
                      waze_url: wazeUrl,
                      gmap_url: gmapUrl,
                      phone_link: phoneLink
                    }
                  })
                });
                alert('Settings saved!');
              } catch (e) {
                alert('Failed to save');
              }
              setIsSavingSettings(false);
            }}
            disabled={isSavingSettings}
            style={{ width: '100%', marginBottom: '2rem' }}
          >
            {isSavingSettings ? 'Saving...' : 'Save Settings'}
          </button>

          <h3 style={{ marginBottom: '1rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>Shop Location & Contact</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Add links to show quick-access icons on the customer booking page. Leave blank to hide the icon.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>Waze URL</label>
            <input type="url" className="form-input" value={wazeUrl} onChange={(e) => setWazeUrl(e.target.value)} placeholder="https://waze.com/ul/..." />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>Google Maps URL</label>
            <input type="url" className="form-input" value={gmapUrl} onChange={(e) => setGmapUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>Phone Number (for calling)</label>
            <input type="tel" className="form-input" value={phoneLink} onChange={(e) => setPhoneLink(e.target.value)} placeholder="+60123456789" />
          </div>
        </div>
      )}

      {/* Billing Modal */}
      {billingBooking && (
        <div className="modal-overlay" onClick={() => setBillingBooking(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Payment</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{billingBooking.name} - {billingBooking.time_slot}</p>

            {inventory.length === 0 ? (
              <p style={{ color: 'var(--danger)' }}>Please add items to your inventory first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                {inventory.map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--secondary)', padding: '1rem', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--accent)' }}
                        checked={selectedItems[item.id] || false}
                        onChange={(e) => setSelectedItems({...selectedItems, [item.id]: e.target.checked})}
                      />
                      <span>{item.name}</span>
                    </div>
                    <strong>RM {parseFloat(item.price).toFixed(2)}</strong>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)' }} onClick={() => setBillingBooking(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={inventory.length === 0} onClick={submitBill}>Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="modal-overlay" onClick={() => setEditingBooking(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Edit Booking</h2>
            
            {editConflict ? (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p style={{ margin: '0 0 1rem 0', color: '#ef4444' }}><strong>Time Slot Unavailable</strong><br/>That time slot is already booked.</p>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>Suggested alternative: <strong>{editConflict}</strong></p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                    setEditForm({ ...editForm, time_slot: editConflict });
                    setEditConflict(null);
                  }}>Use {editConflict}</button>
                  <button className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--text)' }} onClick={() => setEditConflict(null)}>Try Another Time</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveEdit}>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  required
                  placeholder="Customer Name"
                  style={{ marginBottom: '1rem' }}
                />
                <input
                  type="tel"
                  className="form-input"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  required
                  placeholder="Phone Number"
                  style={{ marginBottom: '1rem' }}
                />
                <input
                  type="date"
                  className="form-input"
                  value={editForm.date_string}
                  onChange={(e) => setEditForm({...editForm, date_string: e.target.value})}
                  required
                  style={{ marginBottom: '1rem' }}
                />
                <select
                  className="form-input"
                  value={editForm.time_slot}
                  onChange={(e) => setEditForm({...editForm, time_slot: e.target.value})}
                  style={{ marginBottom: '1.5rem' }}
                >
                  {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>Save Changes</button>
                
                {editingBooking.status !== 'CANCELLED' && editingBooking.status !== 'COMPLETED' && (
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ width: '100%', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this booking?')) {
                        handleUpdateStatus(editingBooking.id, 'CANCELLED');
                        setEditingBooking(null);
                      }
                    }}
                  >
                    Cancel Booking
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
