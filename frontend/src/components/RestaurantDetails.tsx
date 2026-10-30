import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { buildRestaurantReservationPayload, isVenueBookable } from "../customerData";
import type { Media, Restaurant, RestaurantTable } from "../types";

export function RestaurantDetails() {
    const { restaurantId } = useParams();
    const id = Number(restaurantId);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [media, setMedia] = useState<Media[]>([]);
    const [form, setForm] = useState({ tableId: "", date: "", startTime: "", endTime: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        setRestaurant(null);
        setTables([]);
        setMedia([]);
        if (!Number.isInteger(id) || id <= 0) {
            setError("Restaurant not found");
            setLoading(false);
            return;
        }
        Promise.all([
            apiGet<Restaurant>(`/restaurants/${id}`),
            apiGet<RestaurantTable[]>("/tables"),
            apiGet<Media[]>(`/media/restaurant/${id}`).catch(() => [] as Media[]),
        ]).then(([restaurantData, tableRows, mediaRows]) => {
            if (!active) return;
            setRestaurant(restaurantData);
            setTables(tableRows.filter((table) => table.restaurant_id === id));
            setMedia(mediaRows);
        }).catch((caught: unknown) => {
            if (active) setError(caught instanceof Error ? caught.message : "Unable to load restaurant details");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    const primaryImage = useMemo(() => media.find((item) => item.is_primary) ?? media[0], [media]);
    const venueBookable = isVenueBookable(restaurant?.status);
    const reserve = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!form.tableId) { setError("Choose a table first."); return; }
        if (form.endTime <= form.startTime) { setError("End time must be after start time."); return; }
        setSaving(true);
        try {
            await apiPost("/reservations", buildRestaurantReservationPayload(Number(form.tableId), form.date, form.startTime, form.endTime));
            setMessage("Reservation request sent. You can follow its status in My Reservations.");
            setForm({ tableId: "", date: "", startTime: "", endTime: "" });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to create reservation");
        } finally { setSaving(false); }
    };

    if (loading) return <div className="customer-state">Loading restaurant details…</div>;
    if (error && !restaurant) return <div className="customer-state"><div className="alert error" role="alert">{error}</div><Link to="/restaurants" className="restaurant-back-link">Back to restaurants</Link></div>;
    if (!restaurant) return <div className="customer-state">Restaurant not found. <Link to="/restaurants">Return to restaurants</Link></div>;
    const availableTables = venueBookable ? tables.filter((table) => table.status.toLowerCase() === "available") : [];

    return <div className="restaurant-detail-page">
        <Link to="/restaurants" className="restaurant-back-link">← Back to restaurants</Link>
        <div className="restaurant-detail-gallery">
            {primaryImage ? <img className="restaurant-detail-main-image" src={primaryImage.url} alt={restaurant.name} /> : <div className="customer-detail-placeholder restaurant-visual" role="img" aria-label="Restaurant image not available"><span>R</span></div>}
            <div className="restaurant-detail-side-images"><div className="customer-detail-placeholder restaurant-visual" aria-hidden="true" /><div className="customer-detail-placeholder restaurant-visual" aria-hidden="true" /></div>
        </div>
        <div className="restaurant-detail-heading"><div><p className="eyebrow">RESTAURANT · {restaurant.status}</p><h1>{restaurant.name}</h1><p>📍 {restaurant.address}</p>{restaurant.contact_number && <p>{restaurant.contact_number}{restaurant.email ? ` · ${restaurant.email}` : ""}</p>}</div></div>
        {restaurant.description && <p className="restaurant-detail-description">{restaurant.description}</p>}
        {!venueBookable && <div className="customer-form-note">This restaurant is not active and cannot accept reservation requests.</div>}
        <section className="hotel-rooms-section">
            <div className="hotel-rooms-heading"><div><p className="eyebrow">TABLES</p><h2>Reserve a table</h2></div><span>{tables.length} listed</span></div>
            {tables.length ? <form className="customer-booking-form" onSubmit={reserve}>
                {error && <div className="alert error" role="alert">{error}</div>}
                {message && <div className="alert success" role="status">{message} <Link to="/reservations">View reservations</Link></div>}
                {!availableTables.length && <div className="customer-empty-state">No tables are currently listed as available. Ask the restaurant to update its table status.</div>}
                <div className="customer-booking-fields">
                    <label>Table<select required value={form.tableId} onChange={(event) => setForm({ ...form, tableId: event.target.value })}><option value="">Choose a table</option>{availableTables.map((table) => <option key={table.table_id} value={table.table_id}>Table {table.table_number} · seats {table.capacity}</option>)}</select></label>
                    <label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
                    <label>Start time<input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
                    <label>End time<input required type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>
                </div>
                <button className="combined-primary-button" type="submit" disabled={saving || !availableTables.length}>{saving ? "Sending…" : "Send reservation request"}</button>
            </form> : <div className="customer-empty-state">No tables are listed for this restaurant.</div>}
        </section>
    </div>;
}
