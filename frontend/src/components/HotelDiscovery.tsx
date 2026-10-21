import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet } from "../api";
import { filterResources } from "../customerData";
import type { Hotel, Room } from "../types";

export function HotelDiscovery() {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get("search") ?? "");
    const [status, setStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [roomSummaryUnavailable, setRoomSummaryUnavailable] = useState(false);

    useEffect(() => {
        let active = true;
        apiGet<Hotel[]>("/hotels")
            .then((hotelRows) => { if (active) setHotels(hotelRows); })
            .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load hotels"); })
            .finally(() => { if (active) setLoading(false); });
        apiGet<Room[]>("/rooms")
            .then((roomRows) => { if (active) setRooms(roomRows); })
            .catch(() => { if (active) setRoomSummaryUnavailable(true); });
        return () => { active = false; };
    }, []);

    const statuses = [...new Set(hotels.map((hotel) => hotel.status).filter(Boolean))];
    const visibleHotels = useMemo(() => filterResources(hotels, search, status), [hotels, search, status]);
    const syncSearch = (value: string) => {
        setSearch(value);
        setSearchParams(value.trim() ? { search: value.trim() } : {}, { replace: true });
    };

    return <div className="customer-discovery">
        <section className="hero customer-hero compact-hero">
            <p className="eyebrow">A PLACE TO UNWIND</p>
            <h1>Find your stay</h1>
            <p className="hero-description">Search hotels and explore the rooms and rates currently listed in our system.</p>
            <div className="search-area"><div className="search-bar"><input aria-label="Search hotels" placeholder="Search hotels or locations" value={search} onChange={(event) => syncSearch(event.target.value)} /><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>
        </section>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {roomSummaryUnavailable && !loading && hotels.length > 0 && <p className="customer-form-note">Room price summaries are unavailable right now. You can still browse hotel records.</p>}
        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">HOTEL DIRECTORY</p><h2>{loading ? "Loading hotels…" : `${visibleHotels.length} ${visibleHotels.length === 1 ? "hotel" : "hotels"}`}</h2></div></div>
            {loading ? <div className="customer-empty-state">Loading hotel records…</div> : visibleHotels.length ? <div className="sample-listings">
                {visibleHotels.map((hotel) => {
                    const availablePrices = rooms.filter((room) => room.hotel_id === hotel.hotel_id && room.status.toLowerCase() === "available").map((room) => room.price_per_night);
                    const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : null;
                    return <Link className="sample-card customer-resource-card" key={hotel.hotel_id} to={`/hotels/${hotel.hotel_id}`}>
                        <div className="customer-card-visual hotel-visual" aria-hidden="true"><span>H</span></div>
                        <div className="sample-card-body"><p className="eyebrow">HOTEL · {hotel.status}</p><h3>{hotel.name}</h3><p>{hotel.address}</p><p className="customer-card-description">{hotel.description || "Open the hotel page to see its listed rooms."}</p>{lowestPrice !== null && <p className="sample-price">₱{lowestPrice.toLocaleString()} <span>/ night, lowest listed room</span></p>}<span className="signup-button">Explore rooms</span></div>
                    </Link>;
                })}
            </div> : <div className="customer-empty-state"><h3>{error ? "Hotels could not be loaded" : "No matching hotels"}</h3><p>{error ? "Try again after checking your connection." : "Try another search or check back when listings are available."}</p></div>}
        </section>
    </div>;
}
