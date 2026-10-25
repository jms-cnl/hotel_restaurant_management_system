
import { useState } from 'react';

type ReservationCategory = 'Hotels' | 'Dining' | 'Combined';

type ReservationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Cancelled';

type Reservation = {
  id: number;
  name: string;
  location: string;
  category: ReservationCategory;
  checkIn: string;
  checkOut: string;
  duration: string;
  guests: number;
  price: number;
  status: ReservationStatus;
};

type ReservationsProps = {
  staffMode?: boolean;
};

const sampleReservations: Reservation[] = [
  {
    id: 1,
    name: 'Maison Soleil',
    location: 'Ocean View Resort · Miami Beach, FL',
    category: 'Hotels',
    checkIn: 'Nov 20, 2026',
    checkOut: 'Nov 25, 2026',
    duration: '5 nights',
    guests: 2,
    price: 1600,
    status: 'Pending',
  },
  {
    id: 2,
    name: 'The Golden Table',
    location: 'Tagaytay City, Cavite',
    category: 'Dining',
    checkIn: 'Nov 28, 2026',
    checkOut: '',
    duration: '7:00 PM',
    guests: 4,
    price: 1200,
    status: 'Confirmed',
  },
  {
    id: 3,
    name: 'The Garden Retreat',
    location: 'Silang, Cavite',
    category: 'Combined',
    checkIn: 'Dec 10, 2026',
    checkOut: 'Dec 12, 2026',
    duration: '2 nights',
    guests: 2,
    price: 2400,
    status: 'Confirmed',
  },
];

export default function Reservations({
  staffMode = false,
}: ReservationsProps) {
  const [category, setCategory] =
    useState<ReservationCategory>('Hotels');

  const [status, setStatus] = useState('All Statuses');

  const [reservations, setReservations] =
    useState<Reservation[]>(sampleReservations);

  const filteredReservations = reservations.filter((reservation) => {
    const matchesCategory = reservation.category === category;
    const matchesStatus =
      status === 'All Statuses' || reservation.status === status;

    return matchesCategory && matchesStatus;
  });

  function cancelReservation(id: number) {
    const confirmed = window.confirm('Cancel this reservation?');

    if (!confirmed) return;

    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? { ...reservation, status: 'Cancelled' }
          : reservation
      )
    );
  }

  const hotelCount = reservations.filter(
    (reservation) => reservation.category === 'Hotels'
  ).length;

  const diningCount = reservations.filter(
    (reservation) => reservation.category === 'Dining'
  ).length;

  const combinedCount = reservations.filter(
    (reservation) => reservation.category === 'Combined'
  ).length;

  const upcomingCount = reservations.filter(
    (reservation) =>
      reservation.status === 'Confirmed' ||
      reservation.status === 'Pending'
  ).length;

  const totalSpent = reservations
    .filter((reservation) => reservation.status !== 'Cancelled')
    .reduce((total, reservation) => total + reservation.price, 0);

  return (
    <section className="reservations-page">
      <div className="reservations-heading">
        <div>
          <h1>{staffMode ? 'Reservations' : 'My Reservations'}</h1>
          <p>
            {staffMode
              ? 'Manage and monitor all reservations here.'
              : 'Welcome back! Manage all your bookings here.'}
          </p>
        </div>

        <button
          type="button"
          className="combined-stay-button"
          onClick={() =>
            window.alert('Combined stay planning will be added next.')
          }
        >
          + Plan a Combined Stay
        </button>
      </div>

      <div className="reservation-stats">
        <div className="stat-card">
          <span>Hotel Bookings</span>
          <strong>{hotelCount}</strong>
        </div>

        <div className="stat-card">
          <span>Dining Reservations</span>
          <strong>{diningCount}</strong>
        </div>

        <div className="stat-card">
          <span>Combined Stays</span>
          <strong>{combinedCount}</strong>
        </div>

        <div className="stat-card">
          <span>Upcoming</span>
          <strong className="upcoming-number">{upcomingCount}</strong>
        </div>

        <div className="stat-card total-spent-card">
          <span>{staffMode ? 'Total Booking Value' : 'Total Spent'}</span>
          <strong>
            {totalSpent.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            })}
          </strong>
        </div>
      </div>

      <div className="reservation-toolbar">
        <div className="reservation-tabs">
          {(['Hotels', 'Dining', 'Combined'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by reservation status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option>All Statuses</option>
          <option>Pending</option>
          <option>Confirmed</option>
          <option>Cancelled</option>
        </select>
      </div>

      <div className="reservation-list">
        {filteredReservations.length > 0 ? (
          filteredReservations.map((reservation) => (
            <article className="reservation-card" key={reservation.id}>
              <div className="reservation-image-placeholder">
                {reservation.category === 'Dining' ? 'Dining' : 'Stay'}
              </div>

              <div className="reservation-details">
                <div className="reservation-card-heading">
                  <div>
                    <h2>{reservation.name}</h2>
                    <p>{reservation.location}</p>
                  </div>

                  <span
                    className={`reservation-status ${reservation.status.toLowerCase()}`}
                  >
                    {reservation.status}
                  </span>
                </div>

                <div className="reservation-meta">
                  <div>
                    <span>
                      {reservation.category === 'Dining'
                        ? 'DATE'
                        : 'CHECK-IN'}
                    </span>
                    <strong>{reservation.checkIn}</strong>
                  </div>

                  <div>
                    <span>
                      {reservation.category === 'Dining'
                        ? 'TIME'
                        : 'CHECK-OUT'}
                    </span>
                    <strong>
                      {reservation.category === 'Dining'
                        ? reservation.duration
                        : reservation.checkOut}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {reservation.category === 'Dining'
                        ? 'PARTY SIZE'
                        : 'DURATION'}
                    </span>
                    <strong>
                      {reservation.category === 'Dining'
                        ? `${reservation.guests} guests`
                        : reservation.duration}
                    </strong>
                  </div>

                  <div>
                    <span>GUESTS</span>
                    <strong>{reservation.guests}</strong>
                  </div>
                </div>

                <div className="reservation-card-footer">
                  <strong className="reservation-price">
                    {reservation.price.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    })}
                  </strong>

                  {reservation.status !== 'Cancelled' && (
                    <button
                      type="button"
                      className="cancel-reservation-button"
                      onClick={() => cancelReservation(reservation.id)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="reservations-empty-state">
            <h2>No reservations found</h2>
            <p>Try another category or status filter.</p>
          </div>
        )}
      </div>
    </section>
  );
}
