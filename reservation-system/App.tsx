
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';

import Register from './pages/Register';
import Login from './pages/Login';
import Restaurants from './pages/Restaurants';
import CustomerLayout from './components/CustomerLayout';
import Reservations from './pages/Reservations';
import CombinedStay from './pages/CombinedStay';
import RestaurantDetails from './pages/RestaurantDetails';
import HotelDetails from './pages/HotelDetails';
import Profile from './pages/Profile';

function Home({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="app">
      <main>
        <section className="hero">
          <p className="eyebrow">YOUR NEXT GETAWAY STARTS HERE</p>
          <h1>Reserve Your Perfect Escape</h1>
          <p className="hero-description">
            Discover comfortable stays and memorable dining experiences,
            all in one place.
          </p>

          <div className="search-area">
            <form
              className="search-bar"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                type="text"
                placeholder="Search hotels or restaurants..."
                aria-label="Search hotels or restaurants"
              />
              <button type="submit">Search</button>
            </form>

            <div className="filter-bar">
              <label>
                Location
                <select defaultValue="all">
                  <option value="all">All Locations</option>
                  <option value="silang">Silang</option>
                  <option value="tagaytay">Tagaytay</option>
                  <option value="manila">Manila</option>
                </select>
              </label>

              <label>
                Budget
                <select defaultValue="all">
                  <option value="all">Any Budget</option>
                  <option value="budget">Budget-friendly</option>
                  <option value="moderate">Moderate</option>
                  <option value="premium">Premium</option>
                </select>
              </label>

              <label>
                Availability
                <select defaultValue="all">
                  <option value="all">Any Availability</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="listing-section" id="hotels">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HANDPICKED FOR YOU</p>
              <h2>Explore Places to Stay</h2>
            </div>
          </div>
            
<div className="sample-listings">
  <article className="sample-card">
    <img
      src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80"
      alt="Hotel with a swimming pool"
    />
    <div className="sample-card-body">
      <p className="eyebrow">HOTEL</p>
      <h3>Serenity Garden Hotel</h3>
      <p>Silang, Cavite</p>
      <p className="sample-price">₱3,500 <span>/ night</span></p>
      <Link
  to="/hotels/serenity-garden-hotel"
  className="signup-button"
>
  View Hotel
</Link>
    </div>
  </article>

  <article className="sample-card">
    <img
      src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80"
      alt="Restaurant dining area"
    />
    <div className="sample-card-body">
      <p className="eyebrow">RESTAURANT</p>
      <h3>The Garden Table</h3>
      <p>Tagaytay, Cavite</p>
      <p className="sample-price">₱800 <span>/ person, estimated</span></p>
     <Link
  to="/restaurants/the-garden-table"
  className="signup-button"
>
  View Restaurant
</Link>
    </div>
  </article>
</div>

        </section>

        
<section className="combined-cta">
  <p className="eyebrow">MAKE IT A COMPLETE EXPERIENCE</p>
  <h2>Stay, Dine, and Enjoy</h2>
  <p>
    Plan your accommodation and dining experience together in one place.
  </p>

  <Link
    to={loggedIn ? "/combined-stay" : "/login"}
    className="signup-button"
  >
    Plan a Combined Stay
  </Link>
</section>

      </main>
    </div>
  );
}

function Notifications() {
  return (
    <section className="listing-section">
      <h1>Notifications</h1>
      <p>Your notifications will appear here.</p>
    </section>
  );
}


function App() {
  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem('stayeaseDemoLoggedIn') === 'true'
  );

  useEffect(() => {
    function updateAuth() {
      setLoggedIn(
        sessionStorage.getItem('stayeaseDemoLoggedIn') === 'true'
      );
    }

    window.addEventListener('stayease-auth-change', updateAuth);

    return () => {
      window.removeEventListener('stayease-auth-change', updateAuth);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={<CustomerLayout loggedIn={loggedIn} />}
        >
          <Route path="/" element={<Home loggedIn={loggedIn} />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/combined-stay" element={<CombinedStay />} />
          <Route path="/restaurants/the-garden-table" element={<RestaurantDetails />}
/>        <Route path="/hotels/serenity-garden-hotel" element={<HotelDetails />}
/>        <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
