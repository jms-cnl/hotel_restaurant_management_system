import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { BUDGET_TIERS, filterHotels, filterRestaurants } from "../customerData";
import type { Hotel, Media, Restaurant, RestaurantTable, Room } from "../types";

const primaryImageUrl = (media: Media[]) => media.find((item) => item.is_primary)?.url ?? media[0]?.url;

export function CustomerHome() {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [hotelImages, setHotelImages] = useState<Record<number, string>>({});
    const [restaurantImages, setRestaurantImages] = useState<Record<number, string>>({});
    const [search, setSearch] = useState("");
    const [budgetTier, setBudgetTier] = useState("all");
    const [availability, setAvailability] = useState("all");
    const [loading, setLoading] = useState(true);
    const [inventoryError, setInventoryError] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        Promise.allSettled([
            apiGet<Hotel[]>("/hotels"),
            apiGet<Restaurant[]>("/restaurants"),
            apiGet<Room[]>("/rooms"),
            apiGet<RestaurantTable[]>("/tables"),
        ]).then(([hotelResult, restaurantResult, roomResult, tableResult]) => {
            if (!active) return;
            const listingErrors: string[] = [];
            const inventoryErrors: string[] = [];
            if (hotelResult.status === "fulfilled") setHotels(hotelResult.value);
            else listingErrors.push(hotelResult.reason instanceof Error ? hotelResult.reason.message : "Unable to load hotels");
            if (restaurantResult.status === "fulfilled") setRestaurants(restaurantResult.value);
            else listingErrors.push(restaurantResult.reason instanceof Error ? restaurantResult.reason.message : "Unable to load restaurants");
            if (roomResult.status === "fulfilled") setRooms(roomResult.value);
            else inventoryErrors.push("Hotel room pricing and availability are unavailable");
            if (tableResult.status === "fulfilled") setTables(tableResult.value);
            else inventoryErrors.push("Restaurant table availability is unavailable");
            setError(listingErrors.join(" "));
            setInventoryError(inventoryErrors.join(" "));
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const visibleHotels = useMemo(() => filterHotels(hotels, rooms, {
        search,
        budgetTier: inventoryError.includes("Hotel") ? "all" : budgetTier,
        availability: inventoryError ? "all" : availability,
    }), [hotels, rooms, search, budgetTier, availability, inventoryError]);
    const visibleRestaurants = useMemo(() => filterRestaurants(restaurants, tables, {
        search,
        availability: inventoryError ? "all" : availability,
    }), [restaurants, tables, search, availability, inventoryError]);
    const featuredHotel = visibleHotels[0];
    const availableRoomRates = featuredHotel
        ? rooms.filter((room) => room.hotel_id === featuredHotel.hotel_id && room.status.toLowerCase() === "available").map((room) => Number(room.price_per_night)).filter(Number.isFinite)
        : [];
    const lowestRoomRate = availableRoomRates.length ? Math.min(...availableRoomRates) : null;

    useEffect(() => {
        let active = true;
        Promise.all(hotels.map(async (hotel) => {
            try { return [hotel.hotel_id, primaryImageUrl(await apiGet<Media[]>(`/media/hotel/${hotel.hotel_id}`))] as const; }
            catch { return [hotel.hotel_id, undefined] as const; }
        })).then((entries) => {
            if (active) setHotelImages(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => Boolean(entry[1]))));
        });
        return () => { active = false; };
    }, [hotels]);

    useEffect(() => {
        let active = true;
        Promise.all(restaurants.map(async (restaurant) => {
            try { return [restaurant.restaurant_id, primaryImageUrl(await apiGet<Media[]>(`/media/restaurant/${restaurant.restaurant_id}`))] as const; }
            catch { return [restaurant.restaurant_id, undefined] as const; }
        })).then((entries) => {
            if (active) setRestaurantImages(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => Boolean(entry[1]))));
        });
        return () => { active = false; };
    }, [restaurants]);
    const submitSearch = (event: FormEvent) => event.preventDefault();

    return <div className="customer-home">
        <section className="hero customer-hero">
            <p className="eyebrow">YOUR NEXT GETAWAY STARTS HERE</p>
            <h1>Reserve Your Perfect Escape</h1>
            <p className="hero-description">Discover comfortable stays and memorable dining experiences, all in one place.</p>
            <form className="search-area" onSubmit={submitSearch}>
                <div className="search-bar">
                    <input aria-label="Search hotel or restaurant" placeholder="Search hotel or restaurant..." value={search} onChange={(event) => setSearch(event.target.value)} />
                    <button type="submit">Search</button>
                </div>
                <div className="filter-bar">
                    <label>Budget<select value={budgetTier} onChange={(event) => setBudgetTier(event.target.value)} disabled={inventoryError.includes("Hotel")}><option value="all">Any Budget</option>{BUDGET_TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}</select></label>
                    <label>Availability<select value={availability} onChange={(event) => setAvailability(event.target.value)} disabled={Boolean(inventoryError)}><option value="all">Any Availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
                </div>
                <p className="customer-filter-note">Budget uses the lowest available room rate per night; it does not filter restaurant listings.</p>
            </form>
            <div className="hero-links"><Link to="/hotels" className="signup-button">View Maison Valment</Link><Link to="/restaurants" className="login-button">Discover dining</Link></div>
        </section>

        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {inventoryError && <p className="customer-form-note">{inventoryError}. Related filters are disabled.</p>}
        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">YOUR HOTEL</p><h2>{loading ? "Loading Maison Valment…" : featuredHotel?.name ?? "Maison Valment"}</h2></div></div>
            {loading ? <p className="customer-empty-state">Loading hotel details…</p> : featuredHotel ? <div className="sample-listings">
                <Link className="sample-card customer-resource-card" to={`/hotels/${featuredHotel.hotel_id}`}>
                    <div className="customer-card-visual hotel-visual">{hotelImages[featuredHotel.hotel_id] ? <img src={hotelImages[featuredHotel.hotel_id]} alt={featuredHotel.name} /> : <span aria-hidden="true">H</span>}</div>
                    <div className="sample-card-body"><p className="eyebrow">HOTEL · {featuredHotel.status}</p><h3>{featuredHotel.name}</h3><p>{featuredHotel.address}</p><p className="customer-card-description">{featuredHotel.description || "Explore rooms and rates at Maison Valment."}</p>{lowestRoomRate !== null && <p className="sample-price">₱{lowestRoomRate.toLocaleString("en-PH")} <span>/ night, lowest available room</span></p>}<span className="signup-button">View rooms and amenities</span></div>
                </Link>
            </div> : !error && <div className="customer-empty-state"><h3>Maison Valment is not available</h3><p>Please check back later.</p></div>}
        </section>

        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">HANDPICKED FOR YOU</p><h2>{loading ? "Loading restaurants…" : "Explore Restaurants"}</h2></div><Link to="/restaurants">View all restaurants</Link></div>
            {loading ? <p className="customer-empty-state">Loading restaurants…</p> : visibleRestaurants.length ? <div className="sample-listings">
                {visibleRestaurants.map((restaurant) => <Link className="sample-card customer-resource-card" key={restaurant.restaurant_id} to={`/restaurants/${restaurant.restaurant_id}`}>
                    <div className="customer-card-visual restaurant-visual">{restaurantImages[restaurant.restaurant_id] ? <img src={restaurantImages[restaurant.restaurant_id]} alt={restaurant.name} /> : <span aria-hidden="true">R</span>}</div>
                    <div className="sample-card-body"><p className="eyebrow">RESTAURANT · {restaurant.status}</p><h3>{restaurant.name}</h3><p>{restaurant.address}</p><p className="customer-card-description">{restaurant.description || "Browse details and reserve a table."}</p><span className="signup-button">View Restaurant</span></div>
                </Link>)}
            </div> : !error && <div className="customer-empty-state"><h3>No restaurants match these filters</h3><p>Try another search or check back when listings are available.</p></div>}
        </section>

        <section className="combined-cta">
            <p className="eyebrow">MAKE IT A COMPLETE EXPERIENCE</p>
            <h2>Stay, Dine, and Enjoy</h2>
            <p>Plan your accommodation and dining experience together in one place.</p>
            <Link to="/combined-bookings" className="signup-button">Plan a Combined Stay</Link>
        </section>
    </div>;
}
