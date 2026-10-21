import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { buildCombinedBookingPayload, isVenueBookable } from "../customerData";
import type { CombinedBooking, RestaurantTable, Room } from "../types";

const initialForm = { roomId: "", checkIn: "", checkOut: "", tableId: "", date: "", startTime: "", endTime: "" };

export function CustomerCombinedBookings() {
    const [items, setItems] = useState<CombinedBooking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [optionsError, setOptionsError] = useState("");
    const [message, setMessage] = useState("");

    const load = () => {
        setLoading(true);
        setError("");
        setOptionsError("");
        const bookings = apiGet<CombinedBooking[]>("/combined-bookings")
            .then(setItems)
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load combined bookings"));
        const options = Promise.all([apiGet<Room[]>("/rooms"), apiGet<RestaurantTable[]>("/tables")])
            .then(([roomRows, tableRows]) => { setRooms(roomRows); setTables(tableRows); })
            .catch((caught: unknown) => setOptionsError(caught instanceof Error ? caught.message : "Booking options are unavailable"));
        return Promise.all([bookings, options])
            .finally(() => setLoading(false));
    };
    useEffect(() => { void load(); }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (form.checkOut <= form.checkIn) { setError("Check-out must be after check-in."); return; }
        if (form.endTime <= form.startTime) { setError("End time must be after start time."); return; }
        setSaving(true);
        try {
            await apiPost("/combined-bookings/hotel-restaurant", buildCombinedBookingPayload({
                roomId: Number(form.roomId), checkIn: form.checkIn, checkOut: form.checkOut,
                tableId: Number(form.tableId), date: form.date, startTime: form.startTime, endTime: form.endTime,
            }));
            setMessage("Combined booking request sent.");
            setForm(initialForm);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to create combined booking");
        } finally { setSaving(false); }
    };

    const availableRooms = rooms.filter((room) => room.status.toLowerCase() === "available" && isVenueBookable(room.hotel?.status));
    const availableTables = tables.filter((table) => table.status.toLowerCase() === "available" && isVenueBookable(table.restaurant?.status));

    return <section className="customer-combined-bookings">
        <div className="reservations-heading"><div><p className="eyebrow">STAY AND DINE</p><h1>Combined bookings</h1><p>Request a room and a restaurant table together.</p></div><Link to="/hotels" className="combined-stay-button">Browse hotels</Link></div>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {optionsError && <div className="alert error customer-alert" role="alert">{optionsError}. Your existing combined bookings are still shown.</div>}
        {message && <div className="alert success customer-alert" role="status">{message}</div>}
        <div className="combined-booking-list">
            {loading ? <div className="customer-empty-state">Loading combined bookings…</div> : items.length ? items.map((item) => <article className="booking-item combined-booking-card" key={item.combined_booking_id}>
                <p className="eyebrow">COMBINED BOOKING · #{item.combined_booking_id}</p><h2>{item.reservation?.length ?? 0} reservation items</h2><p>Status: <strong>{item.status}</strong></p><small>Requested {item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                {item.reservation?.map((reservation) => <div className="combined-booking-child" key={reservation.reservation_id}><span>{reservation.reservation_type === "HOTEL" ? "Hotel stay" : "Restaurant table"}</span><strong>{reservation.reservation_type === "HOTEL" ? `${reservation.check_in_date ?? ""} – ${reservation.check_out_date ?? ""}` : `${reservation.reservation_date ?? ""} · ${reservation.start_time ?? ""}–${reservation.end_time ?? ""}`}</strong><span>{reservation.status}</span></div>)}
            </article>) : <div className="customer-empty-state"><h2>No combined bookings yet</h2><p>Your requests for a stay and table together will appear here.</p></div>}
        </div>
        <form className="customer-booking-form combined-customer-form" onSubmit={submit}>
            <p className="eyebrow">MAKE A REQUEST</p><h2>Plan a stay and a meal</h2>
            <div className="customer-booking-fields">
                <label>Room<select required value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}><option value="">Choose a room</option>{availableRooms.map((room) => <option key={room.room_id} value={room.room_id}>{room.hotel?.name ? `${room.hotel.name} · ` : ""}{room.room_type} · ₱{room.price_per_night.toLocaleString()}/night</option>)}</select></label>
                <label>Check-in<input required type="date" value={form.checkIn} onChange={(event) => setForm({ ...form, checkIn: event.target.value })} /></label>
                <label>Check-out<input required type="date" value={form.checkOut} onChange={(event) => setForm({ ...form, checkOut: event.target.value })} /></label>
                <label>Table<select required value={form.tableId} onChange={(event) => setForm({ ...form, tableId: event.target.value })}><option value="">Choose a table</option>{availableTables.map((table) => <option key={table.table_id} value={table.table_id}>{table.restaurant?.name ? `${table.restaurant.name} · ` : ""}Table {table.table_number} · seats {table.capacity}</option>)}</select></label>
                <label>Dining date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
                <label>Start time<input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
                <label>End time<input required type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>
            </div>
            {(!availableRooms.length || !availableTables.length) && <p className="customer-form-note">The system needs an available room and table before a combined request can be submitted.</p>}
            <button className="combined-primary-button" type="submit" disabled={saving || !availableRooms.length || !availableTables.length}>{saving ? "Sending…" : "Request combined booking"}</button>
        </form>
    </section>;
}
