import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet } from "../api";
import { canCancelCombinedBooking, canCancelReservation, collectionState, combinedVenueLabel, countWhenAvailable, filterReservations, isUpcomingBooking } from "../customerData";
import type { CombinedBooking, Reservation, RestaurantTable, Room } from "../types";

const statusClass = (status: string) => status.toLowerCase().replaceAll(" ", "-");
const todayInManila = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export function CustomerReservations() {
    const [items, setItems] = useState<Reservation[]>([]);
    const [combinedItems, setCombinedItems] = useState<CombinedBooking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [category, setCategory] = useState("HOTEL");
    const [status, setStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reservationsLoadError, setReservationsLoadError] = useState("");
    const [combinedError, setCombinedError] = useState("");
    const [venueErrors, setVenueErrors] = useState({ rooms: "", tables: "" });
    const [message, setMessage] = useState("");
    const [cancelling, setCancelling] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        setReservationsLoadError("");
        const [reservationResult, combinedResult, roomsResult, tablesResult] = await Promise.allSettled([
            apiGet<Reservation[]>("/reservations"),
            apiGet<CombinedBooking[]>("/combined-bookings"),
            apiGet<Room[]>("/rooms"),
            apiGet<RestaurantTable[]>("/tables"),
        ]);
        const failures: string[] = [];
        if (reservationResult.status === "fulfilled") setItems(reservationResult.value);
        else {
            setItems([]);
            failures.push(reservationResult.reason instanceof Error ? reservationResult.reason.message : "Unable to load reservations");
        }
        const nextCombinedError = combinedResult.status === "rejected"
            ? combinedResult.reason instanceof Error ? combinedResult.reason.message : "Unable to load combined bookings"
            : "";
        setCombinedError(nextCombinedError);
        if (combinedResult.status === "fulfilled") setCombinedItems(combinedResult.value);
        else setCombinedItems([]);
        const nextVenueErrors = {
            rooms: roomsResult.status === "rejected" ? "Unable to load hotel details for combined bookings" : "",
            tables: tablesResult.status === "rejected" ? "Unable to load restaurant details for combined bookings" : "",
        };
        setVenueErrors(nextVenueErrors);
        if (roomsResult.status === "fulfilled") setRooms(roomsResult.value);
        else setRooms([]);
        if (tablesResult.status === "fulfilled") setTables(tablesResult.value);
        else setTables([]);
        const nextReservationsError = failures.join(" ");
        setReservationsLoadError(nextReservationsError);
        setError(nextReservationsError);
        setLoading(false);
        return { reservationsLoaded: reservationResult.status === "fulfilled", combinedLoaded: combinedResult.status === "fulfilled" };
    };
    useEffect(() => { void load(); }, []);

    const standaloneItems = useMemo(() => items.filter((item) => item.combined_booking_id == null), [items]);
    const visibleReservations = useMemo(() => filterReservations(standaloneItems, category, status), [standaloneItems, category, status]);
    const visibleCombined = useMemo(() => combinedItems.filter((item) => status === "all" || item.status === status), [combinedItems, status]);
    const hotelCount = standaloneItems.filter((item) => item.reservation_type === "HOTEL").length;
    const diningCount = standaloneItems.filter((item) => item.reservation_type === "RESTAURANT").length;
    const today = todayInManila();
    const upcomingCount = standaloneItems.filter((item) => isUpcomingBooking(item.status,
        item.reservation_type === "HOTEL" ? item.check_in_date : item.reservation_date, today)).length +
        combinedItems.filter((item) => isUpcomingBooking(item.status,
            item.reservation?.find((reservation) => reservation.reservation_type === "HOTEL")?.check_in_date, today)).length;

    const cancelReservation = async (reservation: Reservation) => {
        if (!canCancelReservation(reservation) || !window.confirm("Cancel this reservation?")) return;
        setCancelling(`reservation:${reservation.reservation_id}`);
        setError("");
        setMessage("");
        try {
            await apiDelete(`/reservations/${reservation.reservation_id}`);
            const refreshed = await load();
            setMessage(refreshed.reservationsLoaded
                ? "Reservation cancelled."
                : "Reservation cancelled, but the list could not be refreshed.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to cancel reservation");
        } finally { setCancelling(""); }
    };

    const cancelCombinedBooking = async (booking: CombinedBooking) => {
        if (!canCancelCombinedBooking(booking.status) || !window.confirm("Cancel this combined booking?")) return;
        setCancelling(`combined:${booking.combined_booking_id}`);
        setError("");
        setMessage("");
        try {
            await apiDelete(`/combined-bookings/${booking.combined_booking_id}`);
            const refreshed = await load();
            setMessage(refreshed.combinedLoaded
                ? "Combined booking cancelled."
                : "Combined booking cancelled, but the list could not be refreshed.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to cancel combined booking");
        } finally { setCancelling(""); }
    };

    return <div className="customer-reservations">
        <div className="reservations-heading"><div><h1>My Reservations</h1><p>Welcome back! Manage all your bookings here.</p></div><Link to="/combined-bookings" className="combined-stay-button">+ Plan a Combined Stay</Link></div>
        <div className="reservation-stats">
            <div className="stat-card"><span>Hotel Bookings</span><strong>{countWhenAvailable(hotelCount, loading, Boolean(reservationsLoadError)) ?? "—"}</strong></div>
            <div className="stat-card"><span>Dining Reservations</span><strong>{countWhenAvailable(diningCount, loading, Boolean(reservationsLoadError)) ?? "—"}</strong></div>
            <div className="stat-card"><span>Combined Stays</span><strong>{countWhenAvailable(combinedItems.length, loading, Boolean(combinedError)) ?? "—"}</strong></div>
            <div className="stat-card"><span>Upcoming</span><strong className="upcoming-number">{countWhenAvailable(upcomingCount, loading, Boolean(reservationsLoadError), Boolean(combinedError)) ?? "—"}</strong></div>
        </div>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {combinedError && <div className="alert error customer-alert" role="alert">Combined bookings unavailable: {combinedError}</div>}
        {venueErrors.rooms && <div className="alert error customer-alert" role="alert">{venueErrors.rooms}</div>}
        {venueErrors.tables && <div className="alert error customer-alert" role="alert">{venueErrors.tables}</div>}
        {message && <div className="alert success customer-alert" role="status">{message}</div>}
        <div className="reservation-toolbar">
            <div className="reservation-tabs" role="group" aria-label="Filter reservation type">
                {[ ["HOTEL", "Hotel"], ["RESTAURANT", "Dining"], ["COMBINED", "Combined"] ].map(([value, label]) => <button key={value} type="button" className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{label}</button>)}
            </div>
            <select aria-label="Filter by reservation status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Statuses</option>{["Pending", "Confirmed", "Cancelled", "Rejected", "Completed"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </div>
        {loading ? <div className="reservations-empty-state"><p>Loading your reservations…</p></div> : category === "COMBINED" ? visibleCombined.length ? <div className="reservation-list">
            {visibleCombined.map((booking) => {
                const hotelReservation = booking.reservation?.find((reservation) => reservation.reservation_type === "HOTEL");
                const diningReservation = booking.reservation?.find((reservation) => reservation.reservation_type === "RESTAURANT");
                const room = rooms.find((item) => item.room_id === hotelReservation?.room_id);
                const table = tables.find((item) => item.table_id === diningReservation?.table_id);
                const hotelName = combinedVenueLabel(room?.hotel?.name, Boolean(venueErrors.rooms), "Hotel stay");
                const diningName = combinedVenueLabel(table?.restaurant?.name, Boolean(venueErrors.tables), "Restaurant table");
                const locations = [room?.hotel?.address, table?.restaurant?.address].filter(Boolean).join(" · ");
                const pendingCancel = cancelling === `combined:${booking.combined_booking_id}`;
                return <article className="reservation-card" key={booking.combined_booking_id}>
                    <div className="reservation-image-placeholder hotel-visual" aria-hidden="true">Stay</div>
                    <div className="reservation-details">
                        <div className="reservation-card-heading"><div><p className="eyebrow">COMBINED STAY</p><h2>{hotelName} &amp; {diningName}</h2>{locations && <p>{locations}</p>}</div><span className={`reservation-status ${statusClass(booking.status)}`}>{booking.status}</span></div>
                        <div className="reservation-meta">
                            <div><span>CHECK-IN</span><strong>{hotelReservation?.check_in_date ?? "—"}</strong></div>
                            <div><span>CHECK-OUT</span><strong>{hotelReservation?.check_out_date ?? "—"}</strong></div>
                            <div><span>DINING DATE</span><strong>{diningReservation?.reservation_date ?? "—"}</strong></div>
                            <div><span>DINING TIME</span><strong>{diningReservation?.start_time ?? "—"}{diningReservation?.end_time ? `–${diningReservation.end_time}` : ""}</strong></div>
                        </div>
                        <div className="reservation-card-footer"><small>Combined booking #{booking.combined_booking_id}</small>{canCancelCombinedBooking(booking.status) && <button type="button" className="cancel-reservation-button" disabled={Boolean(cancelling)} onClick={() => void cancelCombinedBooking(booking)}>{pendingCancel ? "Cancelling…" : "Cancel"}</button>}</div>
                    </div>
                </article>;
            })}
        </div> : collectionState(combinedError, visibleCombined.length) === "unavailable"
            ? <div className="reservations-empty-state"><h2>Combined bookings unavailable</h2><p>Try again after checking your connection.</p></div>
            : <div className="reservations-empty-state"><h2>No combined stays found</h2><p>Your combined booking requests will appear here.</p></div> : visibleReservations.length ? <div className="reservation-list">
            {visibleReservations.map((item) => {
                const hotel = item.room?.hotel;
                const restaurant = item.restaurant_table?.restaurant;
                const isHotel = item.reservation_type === "HOTEL";
                const title = isHotel ? hotel?.name || `Room ${item.room?.room_number ?? item.room_id ?? ""}` : restaurant?.name || `Table ${item.restaurant_table?.table_number ?? item.table_id ?? ""}`;
                const location = isHotel ? hotel?.address : restaurant?.address;
                const pendingCancel = cancelling === `reservation:${item.reservation_id}`;
                return <article className="reservation-card" key={item.reservation_id}>
                    <div className={`reservation-image-placeholder ${isHotel ? "hotel-visual" : "restaurant-visual"}`} aria-hidden="true">{isHotel ? "Stay" : "Dining"}</div>
                    <div className="reservation-details">
                        <div className="reservation-card-heading"><div><p className="eyebrow">{isHotel ? "HOTEL" : "DINING"}</p><h2>{title}</h2>{location && <p>{location}</p>}</div><span className={`reservation-status ${statusClass(item.status)}`}>{item.status}</span></div>
                        <div className="reservation-meta">
                            {isHotel ? <><div><span>ROOM</span><strong>{item.room?.room_type ?? item.room_id ?? "—"}</strong></div><div><span>CHECK-IN</span><strong>{item.check_in_date ?? "—"}</strong></div><div><span>CHECK-OUT</span><strong>{item.check_out_date ?? "—"}</strong></div></> : <><div><span>TABLE</span><strong>{item.restaurant_table?.table_number ?? item.table_id ?? "—"}</strong></div><div><span>DATE</span><strong>{item.reservation_date ?? "—"}</strong></div><div><span>TIME</span><strong>{item.start_time ?? "—"}{item.end_time ? `–${item.end_time}` : ""}</strong></div></>}
                        </div>
                        <div className="reservation-card-footer"><small>Reservation #{item.reservation_id}</small>{canCancelReservation(item) && <button type="button" className="cancel-reservation-button" disabled={Boolean(cancelling)} onClick={() => void cancelReservation(item)}>{pendingCancel ? "Cancelling…" : "Cancel"}</button>}</div>
                    </div>
                </article>;
            })}
        </div> : <div className="reservations-empty-state"><h2>{error ? "Reservations unavailable" : "No reservations found"}</h2><p>{error ? "Try again after checking your connection." : "Your reservations will appear here after you book a room or table."}</p><div><Link to="/hotels" className="combined-stay-button">Explore hotels</Link> <Link to="/restaurants" className="combined-stay-button">Explore restaurants</Link></div></div>}
    </div>;
}
