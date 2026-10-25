import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';

export default function RestaurantDetails() {
  const navigate = useNavigate();
  const loggedIn =
    sessionStorage.getItem('stayeaseDemoLoggedIn') === 'true';
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleReserve() {
    if (!loggedIn) {
      navigate('/login');
      return;
    }

    setSubmitted(false);
    setIsBookingOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      <div className="restaurant-detail-gallery">
        <img
          className="restaurant-detail-main-image"
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85"
          alt="Elegant restaurant interior"
        />

        <div className="restaurant-detail-side-images">
          <img
            src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80"
            alt="Restaurant table setting"
          />
          <img
            src="https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=600&q=80"
            alt="Prepared restaurant meal"
          />
        </div>
      </div>

      <div className="restaurant-detail-heading">
        <div>
          <p className="eyebrow">RESTAURANT · TAGAYTAY</p>
          <h1>The Garden Table</h1>
          <p>Tagaytay, Cavite · Contemporary dining</p>
        </div>

        <div className="restaurant-detail-rating">
          <span>★</span> 4.8
          <small>Sample rating</small>
        </div>
      </div>

      <p className="restaurant-detail-description">
        Enjoy a welcoming dining atmosphere, carefully prepared dishes,
        and a relaxing setting for family meals, celebrations, and special
        occasions.
      </p>

      <div className="restaurant-detail-tags">
        <span>Casual dining</span>
        <span>Family-friendly</span>
        <span>Reservations</span>
        <span>Indoor seating</span>
      </div>

      <div className="restaurant-detail-content-grid">
        <section className="restaurant-detail-panel">
          <p className="eyebrow">DINING OPTIONS</p>
          <h2>Plan your visit</h2>

          <div className="option-row">
            <div>
              <h3>Standard dining</h3>
              <p>Regular table reservation</p>
            </div>
            <strong>₱800 <small>/ person, estimated</small></strong>
          </div>

          <div className="option-row">
            <div>
              <h3>Group dining</h3>
              <p>For family and friends</p>
            </div>
            <strong>By arrangement</strong>
          </div>
        </section>

        <aside className="restaurant-detail-booking-card">
          <p className="eyebrow">MAKE A RESERVATION</p>
          <h2>Enjoy a table at The Garden Table</h2>
          <p>
            Choose your preferred date, time, and party size.
          </p>

          <button
            type="button"
            className="restaurant-detail-book-button"
            onClick={handleReserve}
          >
            Reserve a Table
          </button>

          {!loggedIn && (
            <p>Log in to continue with your table reservation.</p>
          )}

          <p className="restaurant-detail-note">
            Sample listing. Availability and prices are not live.
          </p>
        </aside>
      </div>

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
              aria-label="Close reservation form"
              onClick={() => setIsBookingOpen(false)}
            >
              ×
            </button>

            {submitted ? (
              <div className="booking-success">
                <h2 id="booking-modal-title">Request Submitted</h2>
                <p>
                  Your demo table reservation form was submitted. This
                  prototype does not save a real booking yet.
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
                <h2 id="booking-modal-title">Reserve a Table</h2>
                <p className="booking-modal-subtitle">The Garden Table · Tagaytay</p>

                <div className="booking-room-preview">
                  <img
                    src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=500&q=80"
                    alt="Restaurant table setting"
                  />
                  <div>
                    <h3>Standard Dining</h3>
                    <p>A welcoming table for your meal or special occasion.</p>
                    <strong>₱800/person · Estimated price</strong>
                  </div>
                </div>

                <form className="booking-form" onSubmit={handleSubmit}>
                  <div className="booking-form-row">
                    <label>
                      Reservation date
                      <input type="date" name="reservationDate" required />
                    </label>
                    <label>
                      Reservation time
                      <input type="time" name="reservationTime" required />
                    </label>
                  </div>

                  <label>
                    Number of guests
                    <select name="guests" defaultValue="2" required>
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index + 1} value={index + 1}>
                          {index + 1} {index === 0 ? 'guest' : 'guests'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Special Requests (optional)
                    <textarea
                      name="specialRequests"
                      rows={3}
                      placeholder="Seating preferences, allergies to note, special occasions, etc."
                    />
                  </label>

                  <button type="submit" className="booking-submit-button">
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
