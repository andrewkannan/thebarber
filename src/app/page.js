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
      day: i === 0 ? '' : d.toLocaleDateString('en-US', { weekday: 'short' }),
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
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: `${countryCode} ${phone}`,
          date_string: selectedDate,
          time_slot: selectedSlot
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setSlots(slots.filter(s => s !== selectedSlot));
        setTimeout(() => {
          setShowModal(false);
          setName('');
          setPhone('');
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

  return (
    <main className="container mt-4 mb-8">
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
              <span className="date-num">{d.num}</span>
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
                onClick={() => handleSlotClick(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && !success && setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Confirm Booking</h2>
            <p className="mb-4" style={{ color: '#94a3b8' }}>
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot}
            </p>

            {success ? (
              <div className="glass-panel text-center" style={{ padding: '2rem', borderColor: 'var(--success)' }}>
                <h3 style={{ color: 'var(--success)', margin: '0 0 0.5rem 0' }}>Booking Confirmed!</h3>
                <p>See you soon.</p>
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
    </main>
  );
}
