import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { buildHotelReservationPayload, getAddressCity, isVenueBookable, mergeRoomMedia, refreshRoomMediaOnce } from "../customerData";
import type { Hotel, Media, Room } from "../types";

type Amenity = { amenity_id: number; name: string };
const primaryMedia = (items: Media[]) => items.find((item) => item.is_primary) ?? items[0];

export function HotelDetails() {
    const { hotelId } = useParams();
    const id = Number(hotelId);
    const [hotel, setHotel] = useState<Hotel | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [media, setMedia] = useState<Media[]>([]);
    const [roomMedia, setRoomMedia] = useState<Record<number, Media[]>>({});
    const [amenities, setAmenities] = useState<Amenity[]>([]);
    const [amenitiesError, setAmenitiesError] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [dates, setDates] = useState({ checkIn: "", checkOut: "" });
    const [specialRequest, setSpecialRequest] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const refreshedMedia = useRef(false);
    const refreshingMedia = useRef(false);
    const attemptedRoomMediaRefreshes = useRef(new Set<number>());

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        setHotel(null);
        setRooms([]);
        setMedia([]);
        setRoomMedia({});
        attemptedRoomMediaRefreshes.current.clear();
        setAmenities([]);
        setAmenitiesError(false);
        setSelectedRoom(null);
        refreshedMedia.current = false;
        if (!Number.isInteger(id) || id <= 0) {
            setError("Hotel not found");
            setLoading(false);
            return () => { active = false; };
        }
        Promise.all([
            apiGet<Hotel>(`/hotels/${id}`),
            apiGet<Room[]>("/rooms"),
            apiGet<Media[]>(`/media/hotel/${id}`).catch(() => [] as Media[]),
            apiGet<Amenity[]>(`/amenities?hotel_id=${id}`).then((rows) => ({ rows, failed: false })).catch(() => ({ rows: [] as Amenity[], failed: true })),
        ]).then(async ([hotelData, roomRows, mediaRows, amenityResult]) => {
            const hotelRooms = roomRows.filter((room) => room.hotel_id === id);
            const entries = await Promise.all(hotelRooms.map(async (room) => {
                try { return [room.room_id, await apiGet<Media[]>(`/media/room/${room.room_id}`)] as const; }
                catch { return [room.room_id, [] as Media[]] as const; }
            }));
            if (!active) return;
            setHotel(hotelData);
            setRooms(hotelRooms);
            setMedia(mediaRows);
            setRoomMedia(Object.fromEntries(entries));
            setAmenities(amenityResult.rows);
            setAmenitiesError(amenityResult.failed);
        }).catch((caught: unknown) => {
            if (active) setError(caught instanceof Error ? caught.message : "Unable to load hotel details");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    const mainImage = primaryMedia(media);
    const gallery = useMemo(() => mainImage ? [mainImage, ...media.filter((item) => item.media_id !== mainImage.media_id)].slice(0, 3) : media.slice(0, 3), [media, mainImage]);
    const refreshExpiredMedia = async () => {
        if (refreshedMedia.current || refreshingMedia.current) return;
        refreshedMedia.current = true;
        refreshingMedia.current = true;
        try { setMedia(await apiGet<Media[]>(`/media/hotel/${id}`)); }
        catch { /* Keep the current images if refreshed signed URLs are unavailable. */ }
        finally { refreshingMedia.current = false; }
    };

    const refreshExpiredRoomMedia = async (roomId: number) => {
        const refreshedRoomMedia = await refreshRoomMediaOnce(roomId, attemptedRoomMediaRefreshes.current,
            (failedRoomId) => apiGet<Media[]>(`/media/room/${failedRoomId}`));
        setRoomMedia((current) => mergeRoomMedia(current, roomId, refreshedRoomMedia));
    };

    const openBooking = (room: Room) => {
        setSelectedRoom(room);
        setDates({ checkIn: "", checkOut: "" });
        setSpecialRequest("");
        setSubmitted(false);
        setError("");
    };

    const book = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        if (!selectedRoom) return;
        if (!dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn) {
            setError("Check-out must be after the check-in date.");
            return;
        }
        setSaving(true);
        try {
            await apiPost("/reservations", buildHotelReservationPayload(selectedRoom.room_id, dates.checkIn, dates.checkOut, specialRequest));
            setSubmitted(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to create reservation");
        } finally { setSaving(false); }
    };

    if (loading) return <div className="customer-state">Loading hotel details…</div>;
    if (error && !hotel) return <div className="customer-state"><div className="alert error" role="alert">{error}</div><Link to="/hotels" className="hotel-back-link">Back to hotels</Link></div>;
    if (!hotel) return <div className="customer-state">Hotel not found. <Link to="/hotels">Return to hotels</Link></div>;

    const sideImages = gallery.filter((item) => item.media_id !== mainImage?.media_id).slice(0, 2);
    const venueBookable = isVenueBookable(hotel.status);
    const hotelCity = getAddressCity(hotel.address);
    return <div className="hotel-detail-page">
        <Link to="/home" className="hotel-back-link">← Back to Home</Link>
        <div className="hotel-detail-gallery">
            {mainImage ? <img className="hotel-detail-main-image" src={mainImage.url} alt={hotel.name} onError={() => void refreshExpiredMedia()} /> : <div className="customer-detail-placeholder hotel-visual" role="img" aria-label="Hotel image not available"><span>H</span></div>}
            <div className="hotel-detail-side-images">{sideImages.map((item) => <img key={item.media_id} src={item.url} alt={`${hotel.name} gallery`} onError={() => void refreshExpiredMedia()} />)}{Array.from({ length: 2 - sideImages.length }, (_, index) => <div className="customer-detail-placeholder hotel-visual" aria-hidden="true" key={`empty-${index}`} />)}</div>
        </div>
        <div className="hotel-detail-heading"><div><p className="eyebrow">HOTEL{hotelCity ? ` · ${hotelCity}` : ""}</p><h1>{hotel.name}</h1><p>📍 {hotel.address}</p>{hotel.contact_number && <p>{hotel.contact_number}{hotel.email ? ` · ${hotel.email}` : ""}</p>}</div></div>
        {hotel.description && <p className="hotel-detail-description">{hotel.description}</p>}
        {amenitiesError ? <div className="customer-form-note" role="status">Hotel amenities are unavailable.</div> : amenities.length > 0 && <div className="hotel-detail-tags" aria-label="Hotel amenities">{amenities.map((amenity) => <span key={amenity.amenity_id}>{amenity.name}</span>)}</div>}
        <section className="hotel-rooms-section">
            <div className="hotel-rooms-heading"><div><p className="eyebrow">FIND YOUR PERFECT STAY</p><h2>Available Rooms</h2></div><span>{rooms.filter((room) => room.status.toLowerCase() === "available").length} room types available</span></div>
            {rooms.length ? <div className="hotel-room-list">{rooms.map((room) => {
                const roomImage = primaryMedia(roomMedia[room.room_id] ?? []);
                const available = room.status.toLowerCase() === "available";
                return <article className="hotel-room-card" key={room.room_id}>
                    {roomImage ? <img className="hotel-room-image" src={roomImage.url} alt={room.room_type} onError={() => void refreshExpiredRoomMedia(room.room_id)} /> : <div className="hotel-room-image customer-room-placeholder" aria-hidden="true">{room.room_type.slice(0, 1)}</div>}
                    <div className="hotel-room-info"><h3>{room.room_type}</h3><p>Room {room.room_number}</p></div>
                    <div className="hotel-room-booking"><span className={`hotel-room-status ${available ? "is-available" : "is-booked"}`}>{room.status}</span><strong>₱{Number(room.price_per_night).toLocaleString("en-PH")}<small>/ night</small></strong><button type="button" className="restaurant-detail-book-button" disabled={!venueBookable || !available} onClick={() => openBooking(room)}>Book Room</button></div>
                </article>;
            })}</div> : <div className="customer-empty-state">No rooms are listed for this hotel.</div>}
        </section>
        {!venueBookable && <div className="customer-form-note">This hotel is not active and cannot accept reservation requests.</div>}
        {selectedRoom && <div className="booking-overlay" role="presentation" onClick={() => setSelectedRoom(null)}>
            <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="hotel-booking-title" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="booking-modal-close" aria-label="Close booking form" onClick={() => setSelectedRoom(null)}>×</button>
                {submitted ? <div className="booking-success"><h2 id="hotel-booking-title">Reservation Request Submitted</h2><p>Your reservation request for {selectedRoom.room_type} has been sent.</p><button type="button" className="booking-submit-button" onClick={() => { setSelectedRoom(null); setSubmitted(false); }}>Done</button></div> : <>
                    <h2 id="hotel-booking-title">Book a Room</h2>
                    <p className="booking-modal-subtitle">{hotel.name} · {hotel.address}</p>
                    <div className="booking-room-preview">
                        {primaryMedia(roomMedia[selectedRoom.room_id] ?? []) ? <img src={primaryMedia(roomMedia[selectedRoom.room_id] ?? [])!.url} alt={selectedRoom.room_type} onError={() => void refreshExpiredRoomMedia(selectedRoom.room_id)} /> : <div className="customer-room-placeholder" aria-hidden="true">{selectedRoom.room_type.slice(0, 1)}</div>}
                        <div><h3>{selectedRoom.room_type}</h3><p>Room {selectedRoom.room_number}</p><strong>₱{Number(selectedRoom.price_per_night).toLocaleString("en-PH")} / night</strong></div>
                    </div>
                    <form className="booking-form" onSubmit={book}>
                        {error && <p className="booking-error" role="alert">{error}</p>}
                        <div className="booking-form-row"><label>Check-in<input type="date" required value={dates.checkIn} onChange={(event) => setDates({ ...dates, checkIn: event.target.value })} /></label><label>Check-out<input type="date" min={dates.checkIn || undefined} required value={dates.checkOut} onChange={(event) => setDates({ ...dates, checkOut: event.target.value })} /></label></div>
                        <label>Special Requests (optional)<textarea rows={3} value={specialRequest} onChange={(event) => setSpecialRequest(event.target.value)} placeholder="Anything we should know before your stay?" /></label>
                        <button type="submit" className="booking-submit-button" disabled={saving}>{saving ? "Sending…" : "Confirm Reservation"}</button>
                    </form>
                </>}
            </section>
        </div>}
    </div>;
}
