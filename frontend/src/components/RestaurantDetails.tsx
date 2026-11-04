import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { buildRestaurantReservationPayload, getAddressCity, isVenueBookable } from "../customerData";
import type { Media, Restaurant, RestaurantTable } from "../types";

type Amenity = { amenity_id: number; name: string };
const primaryMedia = (items: Media[]) => items.find((item) => item.is_primary) ?? items[0];

export function RestaurantDetails() {
    const { restaurantId } = useParams();
    const id = Number(restaurantId);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [media, setMedia] = useState<Media[]>([]);
    const [amenities, setAmenities] = useState<Amenity[]>([]);
    const [amenitiesError, setAmenitiesError] = useState(false);
    const [form, setForm] = useState({ tableId: "", date: "", startTime: "", endTime: "", specialRequest: "" });
    const [bookingOpen, setBookingOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const refreshedMedia = useRef(false);
    const refreshingMedia = useRef(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        setRestaurant(null);
        setTables([]);
        setMedia([]);
        setAmenities([]);
        setAmenitiesError(false);
        setBookingOpen(false);
        refreshedMedia.current = false;
        if (!Number.isInteger(id) || id <= 0) {
            setError("Restaurant not found");
            setLoading(false);
            return () => { active = false; };
        }
        Promise.all([
            apiGet<Restaurant>(`/restaurants/${id}`),
            apiGet<RestaurantTable[]>("/tables"),
            apiGet<Media[]>(`/media/restaurant/${id}`).catch(() => [] as Media[]),
            apiGet<Amenity[]>(`/restaurants/${id}/amenities`).then((rows) => ({ rows, failed: false })).catch(() => ({ rows: [] as Amenity[], failed: true })),
        ]).then(([restaurantData, tableRows, mediaRows, amenityResult]) => {
            if (!active) return;
            setRestaurant(restaurantData);
            setTables(tableRows.filter((table) => table.restaurant_id === id));
            setMedia(mediaRows);
            setAmenities(amenityResult.rows);
            setAmenitiesError(amenityResult.failed);
        }).catch((caught: unknown) => {
            if (active) setError(caught instanceof Error ? caught.message : "Unable to load restaurant details");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    const mainImage = primaryMedia(media);
    const gallery = useMemo(() => mainImage ? [mainImage, ...media.filter((item) => item.media_id !== mainImage.media_id)].slice(0, 3) : media.slice(0, 3), [media, mainImage]);
    const refreshExpiredMedia = async () => {
        if (refreshedMedia.current || refreshingMedia.current) return;
        refreshedMedia.current = true;
        refreshingMedia.current = true;
        try { setMedia(await apiGet<Media[]>(`/media/restaurant/${id}`)); }
        catch { /* Keep the current images if refreshed signed URLs are unavailable. */ }
        finally { refreshingMedia.current = false; }
    };
    const venueBookable = isVenueBookable(restaurant?.status);
    const availableTables = venueBookable ? tables.filter((table) => table.status.toLowerCase() === "available") : [];

    const openBooking = () => {
        setForm({ tableId: "", date: "", startTime: "", endTime: "", specialRequest: "" });
        setSubmitted(false);
        setError("");
        setBookingOpen(true);
    };

    const reserve = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        if (!form.tableId) { setError("Choose a table first."); return; }
        if (!form.date) { setError("Choose a reservation date."); return; }
        if (!form.startTime || form.endTime <= form.startTime) { setError("End time must be after start time."); return; }
        setSaving(true);
        try {
            await apiPost("/reservations", buildRestaurantReservationPayload(Number(form.tableId), form.date, form.startTime, form.endTime, form.specialRequest));
            setSubmitted(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to create reservation");
        } finally { setSaving(false); }
    };

    if (loading) return <div className="customer-state">Loading restaurant details…</div>;
    if (error && !restaurant) return <div className="customer-state"><div className="alert error" role="alert">{error}</div><Link to="/restaurants" className="restaurant-back-link">Back to restaurants</Link></div>;
    if (!restaurant) return <div className="customer-state">Restaurant not found. <Link to="/restaurants">Return to restaurants</Link></div>;

    const sideImages = gallery.filter((item) => item.media_id !== mainImage?.media_id).slice(0, 2);
    const restaurantCity = getAddressCity(restaurant.address);
    return <div className="restaurant-detail-page">
        <Link to="/home" className="restaurant-back-link">← Back to Home</Link>
        <div className="restaurant-detail-gallery">
            {mainImage ? <img className="restaurant-detail-main-image" src={mainImage.url} alt={restaurant.name} onError={() => void refreshExpiredMedia()} /> : <div className="customer-detail-placeholder restaurant-visual" role="img" aria-label="Restaurant image not available"><span>R</span></div>}
            <div className="restaurant-detail-side-images">{sideImages.map((item) => <img key={item.media_id} src={item.url} alt={`${restaurant.name} gallery`} onError={() => void refreshExpiredMedia()} />)}{Array.from({ length: 2 - sideImages.length }, (_, index) => <div className="customer-detail-placeholder restaurant-visual" aria-hidden="true" key={`empty-${index}`} />)}</div>
        </div>
        <div className="restaurant-detail-heading"><div><p className="eyebrow">RESTAURANT{restaurantCity ? ` · ${restaurantCity}` : ""}</p><h1>{restaurant.name}</h1><p>📍 {restaurant.address}</p>{restaurant.contact_number && <p>{restaurant.contact_number}{restaurant.email ? ` · ${restaurant.email}` : ""}</p>}</div></div>
        {restaurant.description && <p className="restaurant-detail-description">{restaurant.description}</p>}
        {amenitiesError ? <div className="customer-form-note" role="status">Restaurant amenities are unavailable.</div> : amenities.length > 0 && <div className="restaurant-detail-tags" aria-label="Restaurant amenities">{amenities.map((amenity) => <span key={amenity.amenity_id}>{amenity.name}</span>)}</div>}
        {!venueBookable && <div className="customer-form-note">This restaurant is not active and cannot accept reservation requests.</div>}
        <div className="restaurant-detail-content-grid">
            <section className="restaurant-detail-panel"><p className="eyebrow">DINING OPTIONS</p><h2>Plan your visit</h2>{tables.length > 0 ? <div className="option-row"><div><h3>Table reservations</h3><p>{availableTables.length} available of {tables.length} listed</p></div><strong>Choose a table</strong></div> : <p>No tables are listed for this restaurant.</p>}</section>
            <aside className="restaurant-detail-booking-card"><p className="eyebrow">MAKE A RESERVATION</p><h2>Enjoy a table at {restaurant.name}</h2><p>Choose your preferred table, date, and time.</p><button type="button" className="restaurant-detail-book-button" disabled={!venueBookable || !availableTables.length} onClick={openBooking}>Reserve a Table</button>{!availableTables.length && venueBookable && <p>No tables are currently listed as available.</p>}</aside>
        </div>
        {bookingOpen && <div className="booking-overlay" role="presentation" onClick={() => setBookingOpen(false)}>
            <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-booking-title" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="booking-modal-close" aria-label="Close reservation form" onClick={() => { setBookingOpen(false); setSubmitted(false); }}>×</button>
                {submitted ? <div className="booking-success"><h2 id="restaurant-booking-title">Request Submitted</h2><p>Your reservation request for {restaurant.name} has been sent.</p><button type="button" className="booking-submit-button" onClick={() => { setBookingOpen(false); setSubmitted(false); }}>Done</button></div> : <>
                    <h2 id="restaurant-booking-title">Reserve a Table</h2>
                    <p className="booking-modal-subtitle">{restaurant.name} · {restaurant.address}</p>
                    <div className="booking-room-preview">
                        {mainImage ? <img src={mainImage.url} alt={restaurant.name} /> : <div className="customer-detail-placeholder restaurant-visual" aria-hidden="true">R</div>}
                        <div><h3>{form.tableId ? `Table ${availableTables.find((table) => String(table.table_id) === form.tableId)?.table_number ?? ""}` : "Table reservation"}</h3><p>{form.tableId ? restaurant.name : "Choose a table for your visit."}</p></div>
                    </div>
                    {error && <p className="booking-error" role="alert">{error}</p>}
                    <form className="booking-form" onSubmit={reserve}>
                        <label>Table<select required value={form.tableId} onChange={(event) => setForm({ ...form, tableId: event.target.value })}><option value="">Choose a table</option>{availableTables.map((table) => <option key={table.table_id} value={table.table_id}>Table {table.table_number} · seats {table.capacity}</option>)}</select></label>
                        <div className="booking-form-row"><label>Reservation date<input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Reservation time<input type="time" required value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label></div>
                        <label>End time<input type="time" required value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>
                        <label>Special Requests (optional)<textarea rows={3} value={form.specialRequest} onChange={(event) => setForm({ ...form, specialRequest: event.target.value })} placeholder="Seating preferences or special occasions" /></label>
                        <button type="submit" className="booking-submit-button" disabled={saving || !availableTables.length}>{saving ? "Sending…" : "Confirm Reservation"}</button>
                    </form>
                </>}
            </section>
        </div>}
    </div>;
}
