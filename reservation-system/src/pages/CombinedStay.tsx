
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

const hotels = [
  {
    id: 'serenity',
    name: 'Serenity Garden Hotel',
    location: 'Silang, Cavite',
    image:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'hillside',
    name: 'Tagaytay Hillside Hotel',
    location: 'Tagaytay, Cavite',
    image:
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=80',
  },
];

const rooms = [
  {
    id: 'deluxe',
    name: 'Deluxe Room',
    description: 'Comfortable room with a garden view.',
    price: 3500,
    guests: 2,
  },
  {
    id: 'executive',
    name: 'Executive Suite',
    description: 'Spacious suite with premium amenities.',
    price: 5000,
    guests: 3,
  },
  {
    id: 'presidential',
    name: 'Presidential Suite',
    description: 'Premium accommodation for a luxurious stay.',
    price: 8000,
    guests: 5,
  },
];

const restaurants = [
  {
    id: 'garden-table',
    name: 'The Garden Table',
    location: 'Tagaytay, Cavite',
    price: 800,
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'garden-bistro',
    name: 'Garden Bistro',
    location: 'Silang, Cavite',
    price: 650,
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
  },
];

const money = (amount: number) =>
  `₱${amount.toLocaleString('en-PH')}`;

export default function CombinedStay() {
  const [step, setStep] = useState(1);
  const [hotelId, setHotelId] = useState('serenity');
  const [roomId, setRoomId] = useState('deluxe');
  const [restaurantId, setRestaurantId] = useState('garden-table');

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2');

  const [diningDate, setDiningDate] = useState('');
  const [diningTime, setDiningTime] = useState('19:00');
  const [partySize, setPartySize] = useState('2');
  const [requests, setRequests] = useState('');

  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const hotel = hotels.find((item) => item.id === hotelId)!;
  const room = rooms.find((item) => item.id === roomId)!;
  const restaurant = restaurants.find(
    (item) => item.id === restaurantId
  )!;

  const nights =
    checkIn && checkOut
      ? Math.max(
          0,
          (Date.parse(`${checkOut}T00:00:00`) -
            Date.parse(`${checkIn}T00:00:00`)) /
            86400000
        )
      : 0;

  const total = nights * room.price +
    Number(partySize) * restaurant.price;

  function validateHotel() {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError('Choose a check-out date after your check-in date.');
      return false;
    }

    if (Number(guests) > room.guests) {
      setError(
        `This room accommodates up to ${room.guests} guests. Choose another room or reduce the guest count.`
      );
      return false;
    }

    setError('');
    return true;
  }

  function goToDining() {
    if (validateHotel()) setStep(2);
  }

  function goToReview() {
    if (!diningDate || diningDate < checkIn || diningDate >= checkOut) {
      setError(
        'Choose a dining date between check-in and check-out.'
      );
      return;
    }

    if (!diningTime) {
      setError('Choose a dining time.');
      return;
    }

    setError('');
    setStep(3);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      goToDining();
    } else if (step === 2) {
      goToReview();
    } else {
      setConfirmed(true);
      setError('');
    }
  }

  function changeHotel(id: string) {
    setHotelId(id);
    setError('');
  }

  function changeRoom(id: string) {
    setRoomId(id);
    setError('');
  }

  if (confirmed) {
    return (
      <section className="combined-wizard">
        <div className="combined-wizard-container combined-result">
          <p className="eyebrow">STAYEASE · COMBINED BOOKING</p>
          <h1>Your Combined Stay Plan Is Ready!</h1>
          <p>
            Your demo plan has been prepared. No real reservation
            has been created.
          </p>

          <div className="combined-review-card">
            <h2>{hotel.name}</h2>
            <p>{room.name} · {nights} night(s)</p>
            <p>{checkIn} → {checkOut}</p>
            <h2>{restaurant.name}</h2>
            <p>{diningDate} at {diningTime}</p>
            <p>{partySize} diner(s)</p>
            {requests && <p>Requests: {requests}</p>}
            <h2>Estimated total: {money(total)}</h2>
          </div>

          <button
            type="button"
            className="combined-primary-button"
            onClick={() => {
              setConfirmed(false);
              setStep(1);
            }}
          >
            Plan Another Stay
          </button>

          <Link
  to={
    sessionStorage.getItem('stayeaseDemoRole') === 'staff'
      ? '/staff'
      : '/'
  }
>
  ← Back
</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="combined-wizard">
      <div className="combined-wizard-container">
        <Link
  to={
    sessionStorage.getItem('stayeaseDemoRole') === 'staff'
      ? '/staff'
      : '/'
  }
>
  ← Back
</Link>

        <header className="combined-wizard-header">
          <p className="eyebrow">YOUR COMPLETE GETAWAY</p>
          <h1>Plan Your Complete Stay</h1>
          <p>
            Book your hotel room and dinner reservation in one
            seamless experience.
          </p>
        </header>

        <div className="combined-steps">
          {[
            { number: 1, label: 'Hotel & Room' },
            { number: 2, label: 'Dining' },
            { number: 3, label: 'Review' },
          ].map((item) => (
            <div
              key={item.number}
              className={`combined-step ${
                step === item.number ? 'active' : ''
              } ${step > item.number ? 'completed' : ''}`}
            >
              <span>{step > item.number ? '✓' : item.number}</span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>

        <form
          className="combined-wizard-form"
          onSubmit={handleSubmit}
        >
          {step === 1 && (
            <>
              <p className="eyebrow">CHOOSE YOUR HOTEL</p>

              <div className="combined-hotel-grid">
                {hotels.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`combined-hotel-card ${
                      hotelId === item.id ? 'selected' : ''
                    }`}
                    onClick={() => changeHotel(item.id)}
                    aria-pressed={hotelId === item.id}
                  >
                    <img src={item.image} alt={item.name} />
                    <span className="combined-card-copy">
                      <strong>{item.name}</strong>
                      <small>{item.location}</small>
                      <small>
                        From {money(3500)} / night · Sample listing
                      </small>
                    </span>
                  </button>
                ))}
              </div>

              <p className="eyebrow combined-section-label">
                SELECT A ROOM
              </p>

              <div className="combined-room-list">
                {rooms.map((item) => (
                  <label
                    key={item.id}
                    className={`combined-room-option ${
                      roomId === item.id ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="room"
                      value={item.id}
                      checked={roomId === item.id}
                      onChange={() => changeRoom(item.id)}
                    />
                    <span className="combined-room-copy">
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                      <small>Up to {item.guests} guests</small>
                    </span>
                    <strong className="combined-room-price">
                      {money(item.price)}
                      <small>/ night</small>
                    </strong>
                  </label>
                ))}
              </div>

              <div className="combined-fields">
                <p className="eyebrow">DATES & GUESTS</p>
                <div className="combined-field-grid">
                  <label>
                    Check-in
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(event) => {
                        setCheckIn(event.target.value);
                        setError('');
                      }}
                      required
                    />
                  </label>

                  <label>
                    Check-out
                    <input
                      type="date"
                      min={checkIn || undefined}
                      value={checkOut}
                      onChange={(event) => {
                        setCheckOut(event.target.value);
                        setError('');
                      }}
                      required
                    />
                  </label>

                  <label>
                    Guests
                    <select
                      value={guests}
                      onChange={(event) => setGuests(event.target.value)}
                    >
                      {[1, 2, 3, 4, 5].map((count) => (
                        <option key={count} value={count}>
                          {count} {count === 1 ? 'guest' : 'guests'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="eyebrow">CHOOSE YOUR RESTAURANT</p>

              <div className="combined-hotel-grid">
                {restaurants.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`combined-hotel-card ${
                      restaurantId === item.id ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setRestaurantId(item.id);
                      setError('');
                    }}
                    aria-pressed={restaurantId === item.id}
                  >
                    <img src={item.image} alt={item.name} />
                    <span className="combined-card-copy">
                      <strong>{item.name}</strong>
                      <small>{item.location}</small>
                      <small>
                        Estimated {money(item.price)} / person
                      </small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="combined-fields">
                <p className="eyebrow">DINING DETAILS</p>
                <div className="combined-field-grid">
                  <label>
                    Dining date
                    <input
                      type="date"
                      min={checkIn}
                      max={checkOut ? checkOut : undefined}
                      value={diningDate}
                      onChange={(event) => {
                        setDiningDate(event.target.value);
                        setError('');
                      }}
                      required
                    />
                  </label>

                  <label>
                    Preferred time
                    <select
                      value={diningTime}
                      onChange={(event) =>
                        setDiningTime(event.target.value)
                      }
                    >
                      <option value="12:00">12:00 PM</option>
                      <option value="14:00">2:00 PM</option>
                      <option value="18:00">6:00 PM</option>
                      <option value="19:00">7:00 PM</option>
                      <option value="20:00">8:00 PM</option>
                    </select>
                  </label>

                  <label>
                    Number of diners
                    <select
                      value={partySize}
                      onChange={(event) =>
                        setPartySize(event.target.value)
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                        <option key={count} value={count}>
                          {count} {count === 1 ? 'person' : 'people'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="combined-request-field">
                  Special requests (optional)
                  <textarea
                    rows={3}
                    value={requests}
                    onChange={(event) => setRequests(event.target.value)}
                    placeholder="Seating preferences or special occasions"
                  />
                </label>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="eyebrow">CHECK YOUR SELECTIONS</p>
              <h2 className="combined-review-title">
                Review Your Complete Stay
              </h2>

              <div className="combined-review-card">
                <h3>Hotel & Room</h3>
                <p>{hotel.name} · {hotel.location}</p>
                <p>{room.name} · {guests} guest(s)</p>
                <p>{checkIn} → {checkOut} · {nights} night(s)</p>
                <strong>
                  {money(nights * room.price)}
                  <small> estimated accommodation</small>
                </strong>
              </div>

              <div className="combined-review-card">
                <h3>Dining Reservation</h3>
                <p>{restaurant.name} · {restaurant.location}</p>
                <p>{diningDate} at {diningTime}</p>
                <p>{partySize} diner(s)</p>
                {requests && <p>Requests: {requests}</p>}
                <strong>
                  {money(Number(partySize) * restaurant.price)}
                  <small> estimated dining cost</small>
                </strong>
              </div>

              <div className="combined-total">
                <span>Estimated total</span>
                <strong>{money(total)}</strong>
                <small>
                  Sample rates only. Availability and final prices
                  require backend confirmation.
                </small>
              </div>
            </>
          )}

          {error && (
            <p className="combined-error" role="alert">
              {error}
            </p>
          )}

          <div className="combined-form-actions">
            {step > 1 && (
              <button
                type="button"
                className="combined-secondary-button"
                onClick={() => {
                  setError('');
                  setStep(step - 1);
                }}
              >
                ← Back
              </button>
            )}

            <button type="submit" className="combined-primary-button">
              {step === 1
                ? 'Next: Dining →'
                : step === 2
                  ? 'Review Booking →'
                  : 'Confirm Demo Plan'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}