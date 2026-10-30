import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { filterReservations } from "../customerData";
import type { Reservation } from "../types";

const statusClass = (status: string) => status.toLowerCase().replaceAll(" ", "-");

export function CustomerReservations() {
    const [items, setItems] = useState<Reservation[]>([]);
    const [category, setCategory] = useState("all");
    const [status, setStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = () => {
        setLoading(true);
        setError("");
        return apiGet<Reservation[]>("/reservations")
            .then(setItems)
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load reservations"))
            .finally(() => setLoading(false));
    };
    useEffect(() => { void load(); }, []);

    const visibleItems = useMemo(() => filterReservations(items, category, status), [items, category, status]);
    const upcomingCount = items.filter((item) => item.status === "Pending" || item.status === "Confirmed").length;
    return <div className="customer-reservations">
        <div className="reservations-heading"><div><p className="eyebrow">YOUR BOOKINGS</p><h1>My reservations</h1><p>Track requests and confirmed reservations in one place.</p></div><Link to="/hotels" className="combined-stay-button">Find a stay</Link></div>
        <div className="reservation-stats"><div className="stat-card"><span>All reservations</span><strong>{items.length}</strong></div><div className="stat-card"><span>Upcoming</span><strong className="upcoming-number">{upcomingCount}</strong></div></div>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {message && <div className="alert success customer-alert" role="status">{message}</div>}
        <div className="reservation-toolbar">
            <div className="reservation-tabs" role="group" aria-label="Filter reservation type">
                {[['all', 'All'], ['HOTEL', 'Hotels'], ['RESTAURANT', 'Dining']].map(([value, label]) => <button key={value} type="button" className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{label}</button>)}
            </div>
            <select aria-label="Filter reservation status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{["Pending", "Confirmed", "Rejected", "Completed", "Cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </div>
        {loading ? <div className="reservations-empty-state"><p>Loading your reservations…</p></div> : visibleItems.length ? <div className="reservation-list">
            {visibleItems.map((item) => {
                const hotel = item.room?.hotel;
                const restaurant = item.restaurant_table?.restaurant;
                const isHotel = item.reservation_type === "HOTEL";
                const title = isHotel ? hotel?.name || `Room ${item.room?.room_number ?? item.room_id ?? ""}` : restaurant?.name || `Table ${item.restaurant_table?.table_number ?? item.table_id ?? ""}`;
                const location = isHotel ? hotel?.address : restaurant?.address;
                return <article className="reservation-card" key={item.reservation_id}>
                    <div className={`reservation-image-placeholder ${isHotel ? "hotel-visual" : "restaurant-visual"}`} aria-hidden="true">{isHotel ? "H" : "R"}</div>
                    <div className="reservation-details">
                        <div className="reservation-card-heading"><div><p className="eyebrow">{isHotel ? "HOTEL" : "DINING"}</p><h2>{title}</h2>{location && <p>{location}</p>}</div><span className={`reservation-status ${statusClass(item.status)}`}>{item.status}</span></div>
                        <div className="reservation-meta">
                            {isHotel ? <><div><span>Room</span><strong>{item.room?.room_type ?? item.room_id ?? "—"}</strong></div><div><span>Check-in</span><strong>{item.check_in_date ?? "—"}</strong></div><div><span>Check-out</span><strong>{item.check_out_date ?? "—"}</strong></div></> : <><div><span>Table</span><strong>{item.restaurant_table?.table_number ?? item.table_id ?? "—"}</strong></div><div><span>Date</span><strong>{item.reservation_date ?? "—"}</strong></div><div><span>Time</span><strong>{item.start_time ?? "—"}{item.end_time ? `–${item.end_time}` : ""}</strong></div></>}
                        </div>
                        <div className="reservation-card-footer"><small>Reservation #{item.reservation_id}</small></div>
                    </div>
                </article>;
            })}
        </div> : <div className="reservations-empty-state"><h2>{error ? "Reservations unavailable" : "No reservations found"}</h2><p>{error ? "Try again after checking your connection." : "Your reservations will appear here after you book a room or table."}</p><div><Link to="/hotels" className="combined-stay-button">Explore hotels</Link> <Link to="/restaurants" className="combined-stay-button">Explore restaurants</Link></div></div>}
    </div>;
}
