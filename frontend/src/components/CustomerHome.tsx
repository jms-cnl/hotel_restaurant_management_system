import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import type { Hotel, Restaurant } from "../types";

export function CustomerHome() {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        Promise.allSettled([apiGet<Hotel[]>("/hotels"), apiGet<Restaurant[]>("/restaurants")])
            .then(([hotelResult, restaurantResult]) => {
                if (!active) return;
                if (hotelResult.status === "fulfilled") setHotels(hotelResult.value);
                if (restaurantResult.status === "fulfilled") setRestaurants(restaurantResult.value);
                const errors = [hotelResult, restaurantResult]
                    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
                    .map((result) => result.reason instanceof Error ? result.reason.message : "Unable to load a listing category");
                setError(errors.join(" "));
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        const query = search.trim();
        navigate(query ? `/hotels?search=${encodeURIComponent(query)}` : "/hotels");
    };

    return <div className="customer-home">
        <section className="hero customer-hero">
            <p className="eyebrow">YOUR NEXT GETAWAY STARTS HERE</p>
            <h1>Stay somewhere<br />worth remembering.</h1>
            <p className="hero-description">Find a comfortable stay and reserve a table for your next meal, all in one place.</p>
            <form className="search-area" onSubmit={submitSearch}>
                <div className="search-bar">
                    <input aria-label="Search hotels" placeholder="Search by hotel or location" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <button type="submit">Search stays</button>
                </div>
            </form>
            <div className="hero-links"><Link to="/hotels" className="signup-button">Explore hotels</Link><Link to="/restaurants" className="login-button">Discover dining</Link></div>
        </section>

        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">A PLACE TO UNWIND</p><h2>Find your stay</h2></div><Link to="/hotels">View all hotels</Link></div>
            {loading ? <p className="customer-empty-state">Loading hotels and restaurants…</p> : hotels.length ? <div className="sample-listings">
                {hotels.slice(0, 3).map((hotel) => <Link className="sample-card customer-resource-card" key={hotel.hotel_id} to={`/hotels/${hotel.hotel_id}`}>
                    <div className="customer-card-visual hotel-visual" aria-hidden="true"><span>H</span></div>
                    <div className="sample-card-body"><p className="eyebrow">HOTEL · {hotel.status}</p><h3>{hotel.name}</h3><p>{hotel.address}</p><p className="customer-card-description">{hotel.description || "Explore rooms and rates for this property."}</p><span className="signup-button">View hotel</span></div>
                </Link>)}
            </div> : !error && <div className="customer-empty-state"><h3>No hotels to show yet</h3><p>Hotel listings will appear here when they are added.</p></div>}
        </section>

        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">A TABLE FOR EVERY OCCASION</p><h2>Make time for good food</h2></div><Link to="/restaurants">View all restaurants</Link></div>
            {loading ? <p className="customer-empty-state">Loading restaurants…</p> : restaurants.length ? <div className="sample-listings">
                {restaurants.slice(0, 3).map((restaurant) => <Link className="sample-card customer-resource-card" key={restaurant.restaurant_id} to={`/restaurants/${restaurant.restaurant_id}`}>
                    <div className="customer-card-visual restaurant-visual" aria-hidden="true"><span>R</span></div>
                    <div className="sample-card-body"><p className="eyebrow">RESTAURANT · {restaurant.status}</p><h3>{restaurant.name}</h3><p>{restaurant.address}</p><p className="customer-card-description">{restaurant.description || "Browse details and reserve a table."}</p><span className="signup-button">View restaurant</span></div>
                </Link>)}
            </div> : !error && <div className="customer-empty-state"><h3>No restaurants to show yet</h3><p>Restaurant listings will appear here when they are added.</p></div>}
        </section>
    </div>;
}
