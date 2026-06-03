'use client';

import { useState, useEffect } from 'react';

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

const formatBookingDate = (dateString) => {
  const [y, m, d] = dateString.split('-');
  const dateObj = new Date(y, m - 1, d);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  return { dayName, fullDate: `${parseInt(d, 10)} ${monthName} ${y}` };
};

export default function Home() {
  const [dates] = useState(generateDates());
  const [selectedDate, setSelectedDate] = useState(dates[0].fullString);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [conflictData, setConflictData] = useState(null);

  const [showMyBookings, setShowMyBookings] = useState(false);
  const [myPhoneSearch, setMyPhoneSearch] = useState('');
  const [myBookings, setMyBookings] = useState([]);
  const [loadingMyBookings, setLoadingMyBookings] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [shopSettings, setShopSettings] = useState({});

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings?public=true');
        const data = await res.json();
        setShopSettings(data.settings || {});
      } catch (e) {
        console.error(e);
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const res = await fetch(`/api/slots?date=${selectedDate}`);
        const data = await res.json();
        setSlots(data.availableSlots || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [selectedDate]);

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setShowModal(true);
    setSuccess(false);
    setError('');
    setConflictData(null);
  };

  const getSlotStyle = (slot) => {
    if (selectedSlot === slot) return {};
    const isPM = slot.includes('PM');
    let [hours] = slot.split(' ')[0].split(':').map(Number);
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    if (hours < 12) {
      return { borderLeft: '3px solid #facc15' }; // Morning (Yellow)
    } else if (hours < 17) {
      return { borderLeft: '3px solid #38bdf8' }; // Afternoon (Blue)
    } else {
      return { borderLeft: '3px solid #a78bfa' }; // Evening (Purple)
    }
  };

  const handleBook = async (e, forceReschedule = false) => {
    if (e) e.preventDefault();
    if (!name || !phone) return;
    setIsSubmitting(true);
    setError('');

    try {
      const cleanPhone = (countryCode === '+60' && phone.startsWith('0')) ? phone.substring(1) : phone;
      const fullPhone = `${countryCode} ${cleanPhone}`;
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: fullPhone,
          date_string: selectedDate,
          time_slot: selectedSlot,
          reschedule: forceReschedule
        })
      });
      const data = await res.json();
      
      if (res.status === 409 && data.requiresReschedule) {
        setConflictData(data);
      } else if (res.ok) {
        setSuccess(true);
        // Remove booked slot from UI
        setSlots(slots.filter(s => s !== selectedSlot));
        // Add old slot back if rescheduled
        if (forceReschedule && conflictData) {
          const updatedSlots = [...slots, conflictData.oldSlot].filter(s => s !== selectedSlot);
          // Simple sort logic to keep it neat
          updatedSlots.sort(); 
          setSlots(updatedSlots);
        }
      } else {
        setError(data.error || 'Failed to book');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessOk = () => {
    setShowModal(false);
    setName('');
    setPhone('');
    setConflictData(null);
  };

  const loadMyBookings = async (e) => {
    e.preventDefault();
    if (!myPhoneSearch) return;
    setLoadingMyBookings(true);
    setHasSearched(true);
    try {
      const cleanSearch = (countryCode === '+60' && myPhoneSearch.startsWith('0')) ? myPhoneSearch.substring(1) : myPhoneSearch;
      const res = await fetch(`/api/my-bookings?phone=${encodeURIComponent(countryCode + ' ' + cleanSearch)}`);
      const data = await res.json();
      setMyBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMyBookings(false);
    }
  };

  const cancelBooking = async (id) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const res = await fetch(`/api/my-bookings?id=${id}&phone=${encodeURIComponent(countryCode + ' ' + myPhoneSearch)}`, { method: 'DELETE' });
      if (res.ok) {
        setMyBookings(myBookings.filter(b => b.id !== id));
        // Trigger a refetch of slots if we are on the same date
        const slotsRes = await fetch(`/api/slots?date=${selectedDate}`);
        const slotsData = await slotsRes.json();
        setSlots(slotsData.availableSlots || []);
      }
    } catch (err) {}
  };

  return (
    <main className="container mt-4 mb-8">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button 
          className="btn" 
          style={{ width: 'auto', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border)', fontSize: '0.875rem' }} 
          onClick={() => { setShowMyBookings(true); setHasSearched(false); setMyBookings([]); }}
        >
          My Bookings
        </button>
      </div>

      <div className="text-center mb-8">
        <h1 style={{ marginBottom: (shopSettings.waze_url || shopSettings.gmap_url || shopSettings.phone_link) ? '1.5rem' : '0' }}>thebarber</h1>
        
        {(shopSettings.waze_url || shopSettings.gmap_url || shopSettings.phone_link) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            {shopSettings.waze_url && (
              <a href={shopSettings.waze_url} target="_blank" rel="noopener noreferrer" title="Navigate with Waze" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
              </a>
            )}
            {shopSettings.gmap_url && (
              <a href={shopSettings.gmap_url} target="_blank" rel="noopener noreferrer" title="Open in Google Maps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </a>
            )}
            {shopSettings.phone_link && (
              <a href={`tel:${shopSettings.phone_link.replace(/[^0-9+]/g, '')}`} title="Call Shop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
              </a>
            )}
          </div>
        )}
        <p style={{ color: '#94a3b8' }}>Select a date and time for your fresh cut.</p>
      </div>

      <div className="mb-8">
        <h3 className="form-label">Date</h3>
        <div className="date-selector">
          {dates.map((d, i) => (
            <button
              key={i}
              className={`date-btn ${selectedDate === d.fullString ? 'active' : ''}`}
              onClick={() => { setSelectedDate(d.fullString); setSelectedSlot(null); }}
            >
              <span className="date-day">{d.day}</span>
              <span className="date-num" style={d.num === 'Today' ? { fontSize: '1rem' } : {}}>{d.num}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="form-label">Available Slots</h3>
        {loadingSlots ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="spinner"></div>
          </div>
        ) : slots.length === 0 ? (
          <div className="glass-panel text-center" style={{ padding: '2rem' }}>
            <p>No slots available for this date.</p>
          </div>
        ) : (
          <div className="slots-grid">
            {slots.map((slot, i) => (
              <button
                key={i}
                className={`slot-btn ${selectedSlot === slot ? 'selected' : ''}`}
                style={getSlotStyle(slot)}
                onClick={() => handleSlotClick(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && !success && setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Confirm Booking</h2>
            <p className="mb-4" style={{ color: '#94a3b8' }}>
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot}
            </p>

            {success ? (
              <div className="glass-panel text-center" style={{ padding: '2.5rem 1.5rem', borderColor: 'var(--success)', animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✂️</div>
                <h3 style={{ color: 'var(--success)', margin: '0 0 1.25rem 0', fontSize: '1.5rem' }}>Your slot is locked in!</h3>
                <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
                  The <strong style={{ color: 'var(--accent)', fontSize: '1.1rem', padding: '0 0.25rem' }}>Best Barber in the Town</strong><br/>
                  will review and confirm your booking shortly.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius)', display: 'inline-block', marginBottom: '2rem' }}>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Get ready for a fresh cut
                  </p>
                </div>
                <div>
                  <button className="btn btn-primary" onClick={handleSuccessOk}>
                    OK
                  </button>
                </div>
              </div>
            ) : conflictData ? (
              <div className="glass-panel" style={{ padding: '1.5rem', borderColor: 'var(--accent)' }}>
                <h3 style={{ color: 'var(--accent)', margin: '0 0 1rem 0' }}>Booking Conflict</h3>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  You already have an appointment on this day at <strong>{conflictData.oldSlot}</strong>. Would you like to keep your old time, or reschedule to <strong>{selectedSlot}</strong>?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => handleBook(null, true)} disabled={isSubmitting}>
                    {isSubmitting ? <div className="spinner"></div> : `Reschedule to ${selectedSlot}`}
                  </button>
                  <button className="btn" style={{ background: 'var(--secondary)' }} onClick={() => setShowModal(false)} disabled={isSubmitting}>
                    Keep {conflictData.oldSlot}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBook}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="form-input"
                      style={{ width: 'auto', paddingRight: '1rem', cursor: 'pointer' }}
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="+60">🇲🇾 +60</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>
                    <input
                      type="tel"
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="12 345 6789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel-national"
                      required
                    />
                  </div>
                </div>
                {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button type="button" className="btn" style={{ background: 'var(--secondary)' }} onClick={() => setShowModal(false)} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? <div className="spinner"></div> : 'Book Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* My Bookings Modal */}
      {showMyBookings && (
        <div className="modal-overlay" onClick={() => setShowMyBookings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>My Bookings</h2>
            
            <form onSubmit={loadMyBookings} style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label className="form-label">Enter your phone number to find your bookings</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="form-input"
                    style={{ width: 'auto', paddingRight: '1rem', cursor: 'pointer' }}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+60">🇲🇾 +60</option>
                    <option value="+65">🇸🇬 +65</option>
                  </select>
                  <input
                    type="tel"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="12 345 6789"
                    value={myPhoneSearch}
                    onChange={(e) => setMyPhoneSearch(e.target.value)}
                    autoComplete="tel-national"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loadingMyBookings}>
                {loadingMyBookings ? <div className="spinner"></div> : 'Find Bookings'}
              </button>
            </form>

            {hasSearched && !loadingMyBookings && (
              <div className="glass-panel" style={{ padding: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                {myBookings.length === 0 ? (
                  <p className="text-center" style={{ color: '#94a3b8', margin: 0 }}>No upcoming bookings found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {myBookings.map(b => {
                      const dateInfo = formatBookingDate(b.date_string);
                      return (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <p style={{ margin: '0', fontSize: '1rem', fontWeight: '500' }}>{dateInfo.dayName}</p>
                            <p style={{ color: 'var(--accent)', margin: '0.25rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>{b.time_slot}</p>
                            <p style={{ margin: '0', color: '#94a3b8', fontSize: '0.85rem' }}>{dateInfo.fullDate}</p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                            {b.status === 'CONFIRMED' && (
                              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '0.7rem' }}>CONFIRMED</span>
                            )}
                            {b.status === 'COMPLETED' && (
                              <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', fontSize: '0.7rem' }}>COMPLETED</span>
                            )}
                            {b.status === 'PENDING' && (
                              <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', fontSize: '0.7rem' }}>PENDING</span>
                            )}
                            {b.status === 'CANCELLED' && (
                              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.7rem' }}>CANCELLED</span>
                            )}
                            {b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && (
                              <button 
                                className="btn" 
                                style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                                onClick={() => cancelBooking(b.id)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button className="btn" style={{ background: 'transparent', width: 'auto' }} onClick={() => setShowMyBookings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
