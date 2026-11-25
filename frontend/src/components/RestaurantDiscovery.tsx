import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { filterRestaurants } from "../customerData";
import type { Hotel, Media, Restaurant, RestaurantTable } from "../types";

const primaryImageUrl = (media: Media[]) => media.find((item) => item.is_primary)?.url ?? media[0]?.url;

export function RestaurantDiscovery() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [hotelId, setHotelId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [availability, setAvailability] = useState("all");
    const [images, setImages] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tableSummaryUnavailable, setTableSummaryUnavailable] = useState(false);

    useEffect(() => {
        let active = true;
        apiGet<Restaurant[]>("/restaurants")
            .then((restaurantRows) => { if (active) setRestaurants(restaurantRows); })
            .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load restaurants"); })
            .finally(() => { if (active) setLoading(false); });
        apiGet<RestaurantTable[]>("/tables")
            .then((tableRows) => { if (active) setTables(tableRows); })
            .catch(() => { if (active) setTableSummaryUnavailable(true); });
        apiGet<Hotel[]>("/hotels")
            .then((hotelRows) => { if (active) setHotelId(hotelRows[0]?.hotel_id ?? null); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        Promise.all(restaurants.map(async (restaurant) => {
            try { return [restaurant.restaurant_id, primaryImageUrl(await apiGet<Media[]>(`/media/restaurant/${restaurant.restaurant_id}`))] as const; }
            catch { return [restaurant.restaurant_id, undefined] as const; }
        })).then((entries) => {
            if (active) setImages(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => Boolean(entry[1]))));
        });
        return () => { active = false; };
    }, [restaurants]);

    const visibleRestaurants = useMemo(() => filterRestaurants(restaurants, tables, {
        search,
        availability: tableSummaryUnavailable ? "all" : availability,
    }), [restaurants, tables, search, availability, tableSummaryUnavailable]);

    return <div className="customer-discovery">
        <section className="hero customer-hero compact-hero">
            {hotelId !== null && <Link className="property-return-link" to={`/hotels/${hotelId}`}>← Back to Maison Valment</Link>}
            <p className="eyebrow">DINING AT MAISON VALMENT</p>
            <h1>Discover great dining.</h1>
            <p className="hero-description">Explore restaurants and table options at Maison Valment.</p>
            <div className="search-area">
                <form className="search-bar" onSubmit={(event) => event.preventDefault()}><input aria-label="Search restaurants" placeholder="Search restaurants" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">Search</button></form>
                <div className="filter-bar restaurant-filter-bar">
                    <label>Availability<select aria-label="Filter by availability" value={availability} onChange={(event) => setAvailability(event.target.value)} disabled={tableSummaryUnavailable}><option value="all">Any Availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
                </div>
            </div>
        </section>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {tableSummaryUnavailable && !loading && restaurants.length > 0 && <p className="customer-form-note">Table counts and availability are unavailable right now. You can still browse restaurant records; the related filter is disabled.</p>}
        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">MAISON VALMENT</p><h2>{loading ? "Loading restaurants…" : "Restaurants at Maison Valment"}</h2></div></div>
            {loading ? <div className="customer-empty-state">Loading restaurant records…</div> : visibleRestaurants.length ? <div className="sample-listings">
                {visibleRestaurants.map((restaurant) => {
                    const tableCount = tables.filter((table) => table.restaurant_id === restaurant.restaurant_id).length;
                    return <Link className="sample-card customer-resource-card" key={restaurant.restaurant_id} to={`/restaurants/${restaurant.restaurant_id}`}>
                        <div className="customer-card-visual restaurant-visual">{images[restaurant.restaurant_id] ? <img src={images[restaurant.restaurant_id]} alt={restaurant.name} /> : <span aria-hidden="true">R</span>}</div>
                        <div className="sample-card-body"><p className="eyebrow">RESTAURANT · {restaurant.status}</p><h3>{restaurant.name}</h3><p>{restaurant.address}</p><p className="customer-card-description">{restaurant.description || "Open the restaurant page to see its listed tables."}</p><p className="customer-resource-count">{tableCount} {tableCount === 1 ? "table" : "tables"} listed</p><span className="signup-button">View restaurant</span></div>
                    </Link>;
                })}
            </div> : <div className="customer-empty-state"><h3>{error ? "Restaurants could not be loaded" : "No matching restaurants"}</h3><p>{error ? "Try again after checking your connection." : "Try another search or check back when listings are available."}</p></div>}
        </section>
    </div>;
}
