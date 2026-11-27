import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../api";
import { useAuth } from "../auth";
import { isAdmin, isManager } from "../appAccess";
import { formatAdminCombinedBookingDateTime } from "../bookingTime";
import type { CombinedBooking, RestaurantTable, Room } from "../types";
import { Page } from "./Page";

export const reportRequestPath = (report: string, filters: Record<string, string>) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return `/reports/${report}${query.toString() ? `?${query}` : ""}`;
};

export const reportHasNoRows = (report: string, data: Record<string, unknown> | null) =>
    Boolean(data && ["reservations", "revenue", "tables"].includes(report) && Array.isArray(data.reservations) && data.reservations.length === 0);

export function CombinedBookings() {
    const { user } = useAuth(); const manager = isManager(user); const [items, setItems] = useState<CombinedBooking[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [tables, setTables] = useState<RestaurantTable[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
    const load = () => { setLoading(true); apiGet<CombinedBooking[]>('/combined-bookings').then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false)); };
    useEffect(() => { load(); apiGet<Room[]>('/rooms').then(setRooms).catch(() => undefined); apiGet<RestaurantTable[]>('/tables').then(setTables).catch(() => undefined); }, []);
    const status = async (item: CombinedBooking, next: string) => { try { await apiPatch(`/combined-bookings/${item.combined_booking_id}/status`, { status: next }); load(); } catch (e) { setError(e instanceof Error ? e.message : 'Status update failed'); } };
    return <section className="listing-section staff-manage-page"><p className="eyebrow">{isAdmin(user) ? "ADMIN WORKSPACE" : "STAFF WORKSPACE"}</p><h1>Combined Bookings</h1>{error && <div className="alert error">{error}</div>}<div className="staff-table-wrap"><table className="staff-reservations-table"><thead><tr><th>Reservation</th><th>Guest</th><th>Property / Booking</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item => {
        const hotelReservation = item.reservation?.find(reservation => reservation.room_id != null);
        const diningReservation = item.reservation?.find(reservation => reservation.table_id != null);
        const room = rooms.find(candidate => candidate.room_id === hotelReservation?.room_id) ?? hotelReservation?.room;
        const table = tables.find(candidate => candidate.table_id === diningReservation?.table_id) ?? diningReservation?.restaurant_table;
        const count = item.reservation?.length ?? 0;
        const diningDateTime = hotelReservation
            ? formatAdminCombinedBookingDateTime(diningReservation?.reservation_date, diningReservation?.start_time, diningReservation?.end_time)
            : null;
        return <tr key={item.combined_booking_id}><td><strong>#{item.combined_booking_id}</strong><small>{count} {count === 1 ? 'reservation' : 'reservations'}</small>{item.created_at && <small>Created {item.created_at.slice(0, 10)}</small>}</td><td>{item.user ? `${item.user.first_name} ${item.user.last_name}`.trim() || item.user.email : '—'}</td><td><strong>{room?.hotel?.name ?? (room ? `Hotel #${room.hotel_id}` : '—')}{table?.restaurant?.name ? ` + ${table.restaurant.name}` : ''}</strong><small>{room ? `Room ${room.room_number}` : '—'}{table ? ` · Table ${table.table_number}` : ''}</small></td><td>{hotelReservation?.check_in_date ?? diningReservation?.reservation_date ?? '—'}{hotelReservation?.check_out_date && <small>Until {hotelReservation.check_out_date.slice(0, 10)}</small>}{diningDateTime && <small>{diningDateTime}</small>}</td><td><span className={`reservation-status ${item.status.toLowerCase()}`}>{item.status}</span></td><td><div className="staff-table-actions">{manager && item.status === 'Pending' && <button type="button" onClick={() => status(item, 'Confirmed')}>Confirm</button>}{manager && item.status === 'Confirmed' && <button type="button" onClick={() => status(item, 'Completed')}>Complete</button>}</div></td></tr>;
    })}{loading ? <tr><td colSpan={6} className="staff-empty-state">Loading combined bookings...</td></tr> : items.length === 0 && <tr><td colSpan={6} className="staff-empty-state">No combined bookings found.</td></tr>}</tbody></table></div></section>;
}

export function Reports() {
    const [report, setReport] = useState("reservations"); const [filters, setFilters] = useState({ date_from: "", date_to: "", status: "", type: "", hotel_id: "", restaurant_id: "", room_id: "", table_id: "" });
    const [data, setData] = useState<Record<string, unknown> | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
    const load = async () => { setLoading(true); setError(""); try { setData(await apiGet<Record<string, unknown>>(reportRequestPath(report, filters))); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load report"); } finally { setLoading(false); } };
    useEffect(() => { void load(); }, []);
    const update = (key: keyof typeof filters, value: string) => setFilters({ ...filters, [key]: value });
    const hasNoRows = reportHasNoRows(report, data);
    return <Page title="Reports" error={error} loading={loading}><form className="toolbar" onSubmit={event => { event.preventDefault(); void load(); }}><label>Report<select value={report} onChange={e => setReport(e.target.value)}><option value="reservations">Reservation summary/status</option><option value="revenue">Revenue</option><option value="occupancy">Room occupancy</option><option value="tables">Table reservations</option></select></label><label>From<input type="date" value={filters.date_from} onChange={e => update("date_from", e.target.value)} /></label><label>To<input type="date" value={filters.date_to} onChange={e => update("date_to", e.target.value)} /></label><label>Status<select value={filters.status} onChange={e => update("status", e.target.value)}><option value="">All statuses</option>{["Pending", "Confirmed", "Rejected", "Completed", "Cancelled"].map(status => <option key={status}>{status}</option>)}</select></label><label>Type<select value={filters.type} onChange={e => update("type", e.target.value)}><option value="">All types</option><option>HOTEL</option><option>RESTAURANT</option></select></label><label>Hotel ID<input inputMode="numeric" value={filters.hotel_id} onChange={e => update("hotel_id", e.target.value)} /></label><label>Restaurant ID<input inputMode="numeric" value={filters.restaurant_id} onChange={e => update("restaurant_id", e.target.value)} /></label><label>Room ID<input inputMode="numeric" value={filters.room_id} onChange={e => update("room_id", e.target.value)} /></label><label>Table ID<input inputMode="numeric" value={filters.table_id} onChange={e => update("table_id", e.target.value)} /></label><button type="submit">Load report</button></form>{hasNoRows ? <p className="empty">No matching records.</p> : data ? <div className="report-block"><h2>{report}</h2><pre>{JSON.stringify(data, null, 2)}</pre></div> : <p className="empty">No report data.</p>}</Page>;
}
