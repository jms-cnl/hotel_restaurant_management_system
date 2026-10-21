import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { filterResources } from "../customerData";
import type { Restaurant, RestaurantTable } from "../types";

export function RestaurantDiscovery() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
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
        return () => { active = false; };
    }, []);

    const statuses = [...new Set(restaurants.map((restaurant) => restaurant.status).filter(Boolean))];
    const visibleRestaurants = useMemo(() => filterResources(restaurants, search, status), [restaurants, search, status]);

    return <div className="customer-discovery">
        <section className="hero customer-hero compact-hero">
            <p className="eyebrow">DISCOVER GREAT DINING</p>
            <h1>Find your next<br />favorite restaurant.</h1>
            <p className="hero-description">Explore local restaurants and see the table options currently listed for each one.</p>
            <div className="search-area"><div className="search-bar"><input aria-label="Search restaurants" placeholder="Search restaurants or locations" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>
        </section>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {tableSummaryUnavailable && !loading && restaurants.length > 0 && <p className="customer-form-note">Table counts are unavailable right now. You can still browse restaurant records.</p>}
        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">RESTAURANT DIRECTORY</p><h2>{loading ? "Loading restaurants…" : `${visibleRestaurants.length} ${visibleRestaurants.length === 1 ? "restaurant" : "restaurants"}`}</h2></div></div>
            {loading ? <div className="customer-empty-state">Loading restaurant records…</div> : visibleRestaurants.length ? <div className="sample-listings">
                {visibleRestaurants.map((restaurant) => {
                    const tableCount = tables.filter((table) => table.restaurant_id === restaurant.restaurant_id).length;
                    return <Link className="sample-card customer-resource-card" key={restaurant.restaurant_id} to={`/restaurants/${restaurant.restaurant_id}`}>
                        <div className="customer-card-visual restaurant-visual" aria-hidden="true"><span>R</span></div>
                        <div className="sample-card-body"><p className="eyebrow">RESTAURANT · {restaurant.status}</p><h3>{restaurant.name}</h3><p>{restaurant.address}</p><p className="customer-card-description">{restaurant.description || "Open the restaurant page to see its listed tables."}</p><p className="customer-resource-count">{tableCount} {tableCount === 1 ? "table" : "tables"} listed</p><span className="signup-button">View restaurant</span></div>
                    </Link>;
                })}
            </div> : <div className="customer-empty-state"><h3>{error ? "Restaurants could not be loaded" : "No matching restaurants"}</h3><p>{error ? "Try again after checking your connection." : "Try another search or check back when listings are available."}</p></div>}
        </section>
    </div>;
}
