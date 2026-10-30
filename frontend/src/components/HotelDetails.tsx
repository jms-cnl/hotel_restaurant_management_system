import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { buildHotelReservationPayload, isVenueBookable } from "../customerData";
import type { Hotel, Media, Room } from "../types";

export function HotelDetails() {
    const { hotelId } = useParams();
    const id = Number(hotelId);
    const [hotel, setHotel] = useState<Hotel | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [media, setMedia] = useState<Media[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
    const [dates, setDates] = useState({ checkIn: "", checkOut: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        setHotel(null);
        setRooms([]);
        setMedia([]);
        if (!Number.isInteger(id) || id <= 0) {
            setError("Hotel not found");
            setLoading(false);
            return;
        }
        Promise.all([
            apiGet<Hotel>(`/hotels/${id}`),
            apiGet<Room[]>("/rooms"),
            apiGet<Media[]>(`/media/hotel/${id}`).catch(() => [] as Media[]),
        ]).then(([hotelData, roomRows, mediaRows]) => {
            if (!active) return;
            setHotel(hotelData);
            setRooms(roomRows.filter((room) => room.hotel_id === id));
            setMedia(mediaRows);
        }).catch((caught: unknown) => {
            if (active) setError(caught instanceof Error ? caught.message : "Unable to load hotel details");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    const primaryImage = useMemo(() => media.find((item) => item.is_primary) ?? media[0], [media]);
    const venueBookable = isVenueBookable(hotel?.status);
    const book = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!selectedRoom) { setError("Choose a room first."); return; }
        if (dates.checkOut <= dates.checkIn) { setError("Check-out must be after check-in."); return; }
        setSaving(true);
        try {
            await apiPost("/reservations", buildHotelReservationPayload(selectedRoom, dates.checkIn, dates.checkOut));
            setMessage("Reservation request sent. You can follow its status in My Reservations.");
            setSelectedRoom(null);
            setDates({ checkIn: "", checkOut: "" });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to create reservation");
        } finally { setSaving(false); }
    };

    if (loading) return <div className="customer-state">Loading hotel details…</div>;
    if (error && !hotel) return <div className="customer-state"><div className="alert error" role="alert">{error}</div><Link to="/hotels" className="hotel-back-link">Back to hotels</Link></div>;
    if (!hotel) return <div className="customer-state">Hotel not found. <Link to="/hotels">Return to hotels</Link></div>;

    return <div className="hotel-detail-page">
        <Link to="/hotels" className="hotel-back-link">← Back to hotels</Link>
        <div className="hotel-detail-gallery">
            {primaryImage ? <img className="hotel-detail-main-image" src={primaryImage.url} alt={hotel.name} /> : <div className="customer-detail-placeholder hotel-visual" role="img" aria-label="Hotel image not available"><span>H</span></div>}
            <div className="hotel-detail-side-images"><div className="customer-detail-placeholder hotel-visual" aria-hidden="true" /><div className="customer-detail-placeholder hotel-visual" aria-hidden="true" /></div>
        </div>
        <div className="hotel-detail-heading"><div><p className="eyebrow">HOTEL · {hotel.status}</p><h1>{hotel.name}</h1><p>📍 {hotel.address}</p>{hotel.contact_number && <p>{hotel.contact_number}{hotel.email ? ` · ${hotel.email}` : ""}</p>}</div></div>
        {hotel.description && <p className="hotel-detail-description">{hotel.description}</p>}
        <section className="hotel-rooms-section">
            <div className="hotel-rooms-heading"><div><p className="eyebrow">ROOMS</p><h2>Choose your room</h2></div><span>{rooms.length} listed</span></div>
            {rooms.length ? <div className="hotel-room-list">{rooms.map((room) => <article className="hotel-room-card" key={room.room_id}>
                <div className="hotel-room-image customer-room-placeholder" aria-hidden="true">{room.room_type.slice(0, 1)}</div>
                <div className="hotel-room-info"><h3>{room.room_type}</h3><p>Room {room.room_number} · Capacity {room.capacity}</p><span className={`hotel-room-status ${room.status.toLowerCase() === "available" ? "is-available" : "is-booked"}`}>{room.status}</span></div>
                <div className="hotel-room-booking"><strong>₱{room.price_per_night.toLocaleString()}<small> / night</small></strong><button type="button" className="signup-button" disabled={!venueBookable || room.status.toLowerCase() !== "available"} onClick={() => { setSelectedRoom(room.room_id); setMessage(""); }}>Reserve</button></div>
            </article>)}</div> : <div className="customer-empty-state">No rooms are listed for this hotel.</div>}
        </section>
        {!venueBookable && <div className="customer-form-note">This hotel is not active and cannot accept reservation requests.</div>}
        {selectedRoom !== null && <form className="customer-booking-form" onSubmit={book}>
            <h2>Request a reservation</h2>
            {error && <div className="alert error" role="alert">{error}</div>}
            {message && <div className="alert success" role="status">{message}</div>}
            <div className="customer-booking-fields"><label>Check-in<input required type="date" value={dates.checkIn} onChange={(event) => setDates({ ...dates, checkIn: event.target.value })} /></label><label>Check-out<input required type="date" value={dates.checkOut} onChange={(event) => setDates({ ...dates, checkOut: event.target.value })} /></label></div>
            <div className="combined-form-actions"><button type="submit" className="combined-primary-button" disabled={saving}>{saving ? "Sending…" : "Send reservation request"}</button><button type="button" className="combined-secondary-button" onClick={() => setSelectedRoom(null)}>Cancel</button></div>
        </form>}
        {message && selectedRoom === null && <div className="alert success" role="status">{message} <Link to="/reservations">View reservations</Link></div>}
    </div>;
}
