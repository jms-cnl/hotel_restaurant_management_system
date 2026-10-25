
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';

const availableRooms = [
  {
    id: 'deluxe',
    name: 'Deluxe King',
    description:
      'Spacious room with sweeping city views, a king bed, and a marble bath.',
    price: 3480,
    guests: 2,
    status: 'Available',
    image:
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=500&q=80',
    features: ['City View', 'King Bed', 'Marble Bath'],
  },
  {
    id: 'executive',
    name: 'Executive Suite',
    description:
      'A full suite with a separate living area, dining table, and panoramic views.',
    price: 5890,
    guests: 3,
    status: 'Available',
    image:
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=500&q=80',
    features: ['Panoramic View', 'Separate Living Room', 'Soaking Tub'],
  },
  {
    id: 'presidential',
    name: 'Presidential Suite',
    description:
      'Premium luxury with a private terrace and elegant interiors.',
    price: 12400,
    guests: 4,
    status: 'Fully Booked',
    image:
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=500&q=80',
    features: ['Private Terrace', 'Two Floors', 'Grand Piano'],
  },
];

export default function HotelDetails() {
  const navigate = useNavigate();

  const loggedIn =
    sessionStorage.getItem('stayeaseDemoLoggedIn') === 'true';

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('deluxe');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [specialRequests, setSpecialRequests] = useState('');
  const [error, setError] = useState('');

  const selectedRoom =
    availableRooms.find((room) => room.id === selectedRoomId) ??
    availableRooms[0];

  function handleBookRoom(roomId: string) {
    if (!loggedIn) {
      navigate('/login');
      return;
    }

    setSelectedRoomId(roomId);
    setGuests('1');
    setCheckIn('');
    setCheckOut('');
    setSpecialRequests('');
    setError('');
    setSubmitted(false);
    setIsBookingOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError('Check-out must be after the check-in date.');
      return;
    }

    setSubmitted(true);
  }

  return (
    <section className="restaurant-detail-page">
      <Link
  to={
    sessionStorage.getItem('stayeaseDemoRole') === 'staff'
      ? '/staff'
      : '/'
  }
>
  ← Back
</Link>

      {/* Hotel gallery */}
      <div className="restaurant-detail-gallery">
        <img
          className="restaurant-detail-main-image"
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85"
          alt="Serenity Garden Hotel swimming pool"
        />

        <div className="restaurant-detail-side-images">
          <img
            src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=600&q=80"
            alt="Comfortable hotel bedroom"
          />
          <img
            src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80"
            alt="Hotel resort outdoor area"
          />
        </div>
      </div>

      {/* Hotel information */}
      <div className="restaurant-detail-heading">
        <div>
          <p className="eyebrow">HOTEL · SILANG</p>
          <h1>Serenity Garden Hotel</h1>
          <p>📍 Silang, Cavite, Philippines</p>
          <p>⭐ 4.8/5 · Sample rating</p>
        </div>
      </div>

      <p className="restaurant-detail-description">
        Enjoy a relaxing getaway at Serenity Garden Hotel.
        Experience comfortable accommodation, peaceful surroundings,
        and convenient access to nearby attractions.
      </p>

      <div className="restaurant-detail-tags">
        <span>Free Wi-Fi</span>
        <span>Swimming Pool</span>
        <span>Air Conditioning</span>
        <span>Restaurant</span>
        <span>Parking</span>
      </div>

      {/* Available rooms */}
      <section className="hotel-rooms-section">
        <div className="hotel-rooms-heading">
          <div>
            <p className="eyebrow">FIND YOUR PERFECT STAY</p>
            <h2>Available Rooms</h2>
          </div>

          <span>
            {availableRooms.filter(
              (room) => room.status === 'Available'
            ).length}{' '}
            room types available
          </span>
        </div>

        <div className="hotel-room-list">
          {availableRooms.map((room) => (
            <article className="hotel-room-card" key={room.id}>
              <img
                className="hotel-room-image"
                src={room.image}
                alt={room.name}
              />

              <div className="hotel-room-info">
                <h3>{room.name}</h3>
                <p>{room.description}</p>

                <div className="hotel-room-features">
                  {room.features.map((feature) => (
                    <span key={feature}>{feature}</span>
                  ))}
                </div>

                <small>Up to {room.guests} guests</small>
              </div>

              <div className="hotel-room-booking">
                <span
                  className={`hotel-room-status ${
                    room.status === 'Available'
                      ? 'is-available'
                      : 'is-booked'
                  }`}
                >
                  {room.status}
                </span>

                <strong>
                  ₱{room.price.toLocaleString('en-PH')}
                  <small>/ night</small>
                </strong>

                <button
                  type="button"
                  className="restaurant-detail-book-button"
                  disabled={room.status !== 'Available'}
                  onClick={() => handleBookRoom(room.id)}
                >
                  Book Room
                </button>
              </div>
            </article>
          ))}
        </div>

        {!loggedIn && (
          <p className="hotel-login-note">
            Log in to continue with your room reservation.
          </p>
        )}
      </section>

      {/* Booking overlay */}
      {isBookingOpen && (
        <div
          className="booking-overlay"
          role="presentation"
          onClick={() => setIsBookingOpen(false)}
        >
          <section
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="booking-modal-close"
              aria-label="Close booking form"
              onClick={() => setIsBookingOpen(false)}
            >
              ×
            </button>

            {submitted ? (
              <div className="booking-success">
                <h2 id="booking-modal-title">
                  Reservation Request Submitted
                </h2>

                <p>
                  Your demo reservation request for the{' '}
                  {selectedRoom.name} has been prepared.
                  This prototype does not save a real booking yet.
                </p>

                <button
                  type="button"
                  className="booking-submit-button"
                  onClick={() => setIsBookingOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 id="booking-modal-title">Book a Room</h2>
                <p className="booking-modal-subtitle">
                  Serenity Garden Hotel
                </p>

                <div className="booking-room-preview">
                  <img
                    src={selectedRoom.image}
                    alt={selectedRoom.name}
                  />

                  <div>
                    <h3>{selectedRoom.name}</h3>
                    <p>{selectedRoom.description}</p>
                    <strong>
                      ₱{selectedRoom.price.toLocaleString('en-PH')}
                      /night · Up to {selectedRoom.guests} guests
                    </strong>
                  </div>
                </div>

                <form
                  className="booking-form"
                  onSubmit={handleSubmit}
                >
                  <div className="booking-form-row">
                    <label>
                      Check-in
                      <input
                        type="date"
                        name="checkIn"
                        value={checkIn}
                        min={new Date().toLocaleDateString('en-CA')}
                        onChange={(event) => {
                          setCheckIn(event.target.value);

                          if (
                            checkOut &&
                            event.target.value >= checkOut
                          ) {
                            setCheckOut('');
                          }
                        }}
                        required
                      />
                    </label>

                    <label>
                      Check-out
                      <input
                        type="date"
                        name="checkOut"
                        value={checkOut}
                        min={checkIn || new Date().toLocaleDateString('en-CA')}
                        onChange={(event) =>
                          setCheckOut(event.target.value)
                        }
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Guests
                    <select
                      name="guests"
                      value={guests}
                      onChange={(event) =>
                        setGuests(event.target.value)
                      }
                      required
                    >
                      {Array.from(
                        { length: selectedRoom.guests },
                        (_, index) => index + 1
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count}{' '}
                          {count === 1 ? 'guest' : 'guests'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Special Requests (optional)
                    <textarea
                      name="specialRequests"
                      rows={3}
                      value={specialRequests}
                      onChange={(event) =>
                        setSpecialRequests(event.target.value)
                      }
                      placeholder="Late check-in, room preferences, etc."
                    />
                  </label>

                  {error && (
                    <p className="booking-error" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="booking-submit-button"
                  >
                    Confirm Reservation
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}