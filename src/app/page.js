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
      const fullPhone = `${countryCode} ${phone}`;
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
        setTimeout(() => {
          setShowModal(false);
          setName('');
          setPhone('');
          setConflictData(null);
        }, 2000);
      } else {
        setError(data.error || 'Failed to book');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadMyBookings = async (e) => {
    e.preventDefault();
    if (!myPhoneSearch) return;
    setLoadingMyBookings(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/my-bookings?phone=${encodeURIComponent(countryCode + ' ' + myPhoneSearch)}`);
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
        <h1>Sag The Barber</h1>
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
              <div className="glass-panel text-center" style={{ padding: '2rem', borderColor: 'var(--success)' }}>
                <h3 style={{ color: 'var(--success)', margin: '0 0 1rem 0' }}>Booking Submitted!</h3>
                <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                  <strong style={{ color: 'var(--accent)', fontSize: '1.1rem', display: 'block', marginBottom: '0.25rem' }}>Best Barber in the Town</strong> 
                  will confirm your booking shortly.
                </p>
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
                    {myBookings.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <p style={{ fontWeight: '600', margin: '0 0 0.25rem 0' }}>{b.date_string}</p>
                          <p style={{ color: 'var(--accent)', margin: 0, fontSize: '0.9rem' }}>{b.time_slot}</p>
                        </div>
                        <button 
                          className="btn" 
                          style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                          onClick={() => cancelBooking(b.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
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
