import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet } from "../api";
import { BUDGET_TIERS, filterHotels, getAddressLocations } from "../customerData";
import type { Hotel, Media, Room } from "../types";

const primaryImageUrl = (media: Media[]) => media.find((item) => item.is_primary)?.url ?? media[0]?.url;

export function HotelDiscovery() {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get("search") ?? "");
    const [location, setLocation] = useState("all");
    const [budgetTier, setBudgetTier] = useState("all");
    const [availability, setAvailability] = useState("all");
    const [images, setImages] = useState<Record<number, string>>({});
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

    useEffect(() => {
        let active = true;
        Promise.all(hotels.map(async (hotel) => {
            try { return [hotel.hotel_id, primaryImageUrl(await apiGet<Media[]>(`/media/hotel/${hotel.hotel_id}`))] as const; }
            catch { return [hotel.hotel_id, undefined] as const; }
        })).then((entries) => {
            if (active) setImages(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => Boolean(entry[1]))));
        });
        return () => { active = false; };
    }, [hotels]);

    const locations = getAddressLocations(hotels);
    const visibleHotels = useMemo(() => filterHotels(hotels, rooms, {
        search,
        location,
        budgetTier: roomSummaryUnavailable ? "all" : budgetTier,
        availability: roomSummaryUnavailable ? "all" : availability,
    }), [hotels, rooms, search, location, budgetTier, availability, roomSummaryUnavailable]);
    const syncSearch = (value: string) => {
        setSearch(value);
        setSearchParams(value.trim() ? { search: value.trim() } : {}, { replace: true });
    };

    return <div className="customer-discovery">
        <section className="hero customer-hero compact-hero">
            <p className="eyebrow">A PLACE TO UNWIND</p>
            <h1>Find your stay</h1>
            <p className="hero-description">Search hotels and explore the rooms and rates currently listed in our system.</p>
            <div className="search-area">
                <div className="search-bar"><input aria-label="Search hotels" placeholder="Search hotels or locations" value={search} onChange={(event) => syncSearch(event.target.value)} /><button type="button" onClick={() => syncSearch(search)}>Search</button></div>
                <div className="filter-bar">
                    <label>Location<select aria-label="Filter by location" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All Locations</option>{locations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                    <label>Budget<select aria-label="Filter by budget" value={budgetTier} onChange={(event) => setBudgetTier(event.target.value)} disabled={roomSummaryUnavailable}><option value="all">Any Budget</option>{BUDGET_TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}</select></label>
                    <label>Availability<select aria-label="Filter by availability" value={availability} onChange={(event) => setAvailability(event.target.value)} disabled={roomSummaryUnavailable}><option value="all">Any Availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
                </div>
            </div>
        </section>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {roomSummaryUnavailable && !loading && hotels.length > 0 && <p className="customer-form-note">Room pricing and availability are unavailable right now. You can still browse hotel records; the related filters are disabled.</p>}
        <section className="listing-section customer-listing-section">
            <div className="section-heading"><div><p className="eyebrow">HOTEL DIRECTORY</p><h2>{loading ? "Loading hotels…" : `${visibleHotels.length} ${visibleHotels.length === 1 ? "hotel" : "hotels"}`}</h2></div></div>
            {loading ? <div className="customer-empty-state">Loading hotel records…</div> : visibleHotels.length ? <div className="sample-listings">
                {visibleHotels.map((hotel) => {
                    const availablePrices = rooms.filter((room) => room.hotel_id === hotel.hotel_id && room.status.toLowerCase() === "available").map((room) => room.price_per_night);
                    const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : null;
                    return <Link className="sample-card customer-resource-card" key={hotel.hotel_id} to={`/hotels/${hotel.hotel_id}`}>
                        <div className="customer-card-visual hotel-visual">{images[hotel.hotel_id] ? <img src={images[hotel.hotel_id]} alt={hotel.name} /> : <span aria-hidden="true">H</span>}</div>
                        <div className="sample-card-body"><p className="eyebrow">HOTEL · {hotel.status}</p><h3>{hotel.name}</h3><p>{hotel.address}</p><p className="customer-card-description">{hotel.description || "Open the hotel page to see its listed rooms."}</p>{lowestPrice !== null && <p className="sample-price">₱{lowestPrice.toLocaleString()} <span>/ night, lowest listed room</span></p>}<span className="signup-button">Explore rooms</span></div>
                    </Link>;
                })}
            </div> : <div className="customer-empty-state"><h3>{error ? "Hotels could not be loaded" : "No matching hotels"}</h3><p>{error ? "Try again after checking your connection." : "Try another search or check back when listings are available."}</p></div>}
        </section>
    </div>;
}
