
import { useNavigate } from 'react-router-dom';
import '../App.css';

function Restaurants() {

    const navigate = useNavigate();

function handleRestaurantClick() {
  navigate('/restaurants/the-garden-table');
}
  return (
    <div className="app">
      

      <main>
        <section className="hero">
          <p className="eyebrow">DISCOVER GREAT DINING</p>

          <h1>Find Your Next Favorite Restaurant</h1>

          <p className="hero-description">
            Explore memorable dining experiences and discover
            restaurants perfect for every occasion.
          </p>

          <div className="search-area">
            <form
              className="search-bar"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                type="text"
                placeholder="Search restaurants..."
                aria-label="Search restaurants"
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

        <section className="listing-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EXPLORE LOCAL DINING</p>
              <h2>Restaurants for You</h2>
            </div>
          </div>

            
  <article
    className="sample-card restaurant-listing-card"
    onClick={handleRestaurantClick}
    role="link"
    tabIndex={0}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleRestaurantClick();
      }
    }}
  >
    <img
      src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80"
      alt="The Garden Table restaurant interior"
    />

    <div className="sample-card-body">
      <p className="eyebrow">RESTAURANT</p>
      <h3>The Garden Table</h3>
      <p>Tagaytay, Cavite</p>
      <p className="sample-price">
        ₱800 <span>/ person, estimated</span>
      </p>

      <button
        type="button"
        className="signup-button"
        onClick={(event) => {
          event.stopPropagation();
          handleRestaurantClick();
        }}
      >
        View Restaurant
      </button>
    </div>
  </article>


        </section>
      </main>
    </div>
  );
}

export default Restaurants;
