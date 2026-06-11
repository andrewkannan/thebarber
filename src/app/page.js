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
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [setRes, invRes] = await Promise.all([
          fetch('/api/settings?public=true'),
          fetch('/api/inventory')
        ]);
        const setData = await setRes.json();
        const invData = await invRes.json();
        setShopSettings(setData.settings || {});
        setInventory(invData.inventory || []);
      } catch (e) {
        console.error(e);
      }
    }
    fetchInitialData();
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
        <h1 style={{ marginBottom: shopSettings.caption ? '0.5rem' : ((shopSettings.waze_url || shopSettings.gmap_url || shopSettings.phone_link || shopSettings.phone_call) ? '1.5rem' : '0') }}>thebarber</h1>
        {shopSettings.caption && (
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '1.1rem' }}>{shopSettings.caption}</p>
        )}
        
        {(shopSettings.waze_url || shopSettings.gmap_url || shopSettings.phone_link || shopSettings.phone_call) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            {shopSettings.waze_url && (
              <a href={shopSettings.waze_url} target="_blank" rel="noopener noreferrer" title="Navigate with Waze" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13.218 0C9.915 0 6.835 1.49 4.723 4.148c-1.515 1.913-2.31 4.272-2.31 6.706v1.739c0 .894-.62 1.738-1.862 1.813-.298.025-.547.224-.547.522-.05.82.82 2.31 2.012 3.502.82.844 1.788 1.515 2.832 2.036a3 3 0 0 0 2.955 3.528 2.966 2.966 0 0 0 2.931-2.385h2.509c.323 1.689 2.086 2.856 3.974 2.21 1.64-.546 2.36-2.409 1.763-3.924a12.84 12.84 0 0 0 1.838-1.465 10.73 10.73 0 0 0 3.18-7.65c0-2.882-1.118-5.589-3.155-7.625A10.899 10.899 0 0 0 13.218 0zm0 1.217c2.558 0 4.967.994 6.78 2.807a9.525 9.525 0 0 1 2.807 6.78A9.526 9.526 0 0 1 20 17.585a9.647 9.647 0 0 1-6.78 2.807h-2.46a3.008 3.008 0 0 0-2.93-2.41 3.03 3.03 0 0 0-2.534 1.367v.024a8.945 8.945 0 0 1-2.41-1.788c-.844-.844-1.316-1.614-1.515-2.11a2.858 2.858 0 0 0 1.441-.846 2.959 2.959 0 0 0 .795-2.036v-1.789c0-2.11.696-4.197 2.012-5.861 1.863-2.385 4.62-3.726 7.6-3.726zm-2.41 5.986a1.192 1.192 0 0 0-1.191 1.192 1.192 1.192 0 0 0 1.192 1.193A1.192 1.192 0 0 0 12 8.395a1.192 1.192 0 0 0-1.192-1.192zm7.204 0a1.192 1.192 0 0 0-1.192 1.192 1.192 1.192 0 0 0 1.192 1.193 1.192 1.192 0 0 0 1.192-1.193 1.192 1.192 0 0 0-1.192-1.192zm-7.377 4.769a.596.596 0 0 0-.546.845 4.813 4.813 0 0 0 4.346 2.757 4.77 4.77 0 0 0 4.347-2.757.596.596 0 0 0-.547-.845h-.025a.561.561 0 0 0-.521.348 3.59 3.59 0 0 1-3.254 2.061 3.591 3.591 0 0 1-3.254-2.061.64.64 0 0 0-.546-.348z"/></svg>
            </a>
            )}
            {shopSettings.gmap_url && (
              <a href={shopSettings.gmap_url} target="_blank" rel="noopener noreferrer" title="Open in Google Maps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z"/></svg>
              </a>
            )}
            {shopSettings.phone_link && (
              <a href={`https://wa.me/${shopSettings.phone_link.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp Shop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              </a>
            )}
            {shopSettings.phone_call && (
              <a href={`tel:${shopSettings.phone_call.replace(/[^0-9+]/g, '')}`} title="Call Shop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--text)', transition: 'transform 0.2s' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
              </a>
            )}
          </div>
        )}
      </div>

      {shopSettings.barber_name && (
        <div className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexDirection: 'column', textAlign: 'center' }}>
          {shopSettings.barber_photo_url && (
            <img src={shopSettings.barber_photo_url} alt={shopSettings.barber_name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
          )}
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>Meet {shopSettings.barber_name}</h2>
            {shopSettings.barber_bio && <p style={{ color: '#94a3b8', margin: 0, lineHeight: '1.6' }}>{shopSettings.barber_bio}</p>}
          </div>
        </div>
      )}

      {inventory.length > 0 && (
        <div className="mb-8">
          <h3 className="form-label" style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Services & Pricing</h3>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {Object.entries(inventory.reduce((acc, item) => {
                const cat = item.category || 'Services';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
              }, {})).map(([categoryName, items]) => (
                <div key={categoryName}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{categoryName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--border)' }}>
                        <span style={{ color: 'var(--text)' }}>{item.name}</span>
                        <strong style={{ color: 'var(--foreground)' }}>RM {parseFloat(item.price).toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className="form-label" style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Book a Time</h3>
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

      {(shopSettings.shop_address || shopSettings.shop_hours) && (
        <div style={{ marginTop: '4rem', padding: '2rem', background: 'var(--secondary)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          {shopSettings.shop_address && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Location</h4>
              <p style={{ color: '#94a3b8', margin: 0, whiteSpace: 'pre-line', lineHeight: '1.6' }}>{shopSettings.shop_address}</p>
            </div>
          )}
          {shopSettings.shop_hours && (
            <div>
              <h4 style={{ color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Opening Hours</h4>
              <p style={{ color: '#94a3b8', margin: 0, whiteSpace: 'pre-line', lineHeight: '1.6' }}>{shopSettings.shop_hours}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
