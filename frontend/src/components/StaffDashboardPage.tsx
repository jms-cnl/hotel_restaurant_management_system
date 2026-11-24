import { useEffect, useState } from "react";
import { apiGet } from "../api";
import { AvailabilityCard, RoomAvailabilityCard, TableAvailabilityCard } from "../staffDashboard";
import { Reservation, Room, RestaurantTable, User } from "../types";

type DashboardData = { rooms: number };
type OccupancyReport = { totalRooms: number; occupiedRooms: number; occupancyRate: number };

export function StaffDashboardPage({ user }: { user: User | null }) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [occupancyReport, setOccupancyReport] = useState<OccupancyReport | null>(null);
    const [items, setItems] = useState<Reservation[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        Promise.allSettled([
            apiGet<DashboardData>("/dashboard"),
            apiGet<Reservation[]>("/reservations"),
            apiGet<Room[]>("/rooms"),
            apiGet<RestaurantTable[]>("/tables"),
            apiGet<OccupancyReport>("/reports/occupancy"),
        ]).then((results) => {
            if (!active) return;
            const [dashboardResult, reservationResult, roomResult, tableResult, occupancyResult] = results;
            if (dashboardResult.status === "fulfilled") setData(dashboardResult.value);
            else setError(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "Unable to load dashboard.");
            if (reservationResult.status === "fulfilled") setItems(reservationResult.value);
            if (roomResult.status === "fulfilled") setRooms(roomResult.value);
            if (tableResult.status === "fulfilled") setTables(tableResult.value);
            if (occupancyResult.status === "fulfilled") setOccupancyReport(occupancyResult.value);
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const cards: AvailabilityCard[] = [new RoomAvailabilityCard(rooms), new TableAvailabilityCard(tables)];
    const hotelReservations = items.filter((item) => item.reservation_type === "HOTEL");
    const diningReservations = items.filter((item) => item.reservation_type === "RESTAURANT");
    const active = (item: Reservation) => item.status === "Pending" || item.status === "Confirmed";
    const recent = [...items].sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? "")).slice(0, 5);
    const reservationStatuses = [
        { label: "Confirmed", className: "confirmed" },
        { label: "Pending", className: "pending" },
        { label: "Cancelled", className: "cancelled" },
        { label: "Completed", className: "completed" },
    ].map((status) => ({ ...status, count: items.filter((item) => item.status === status.label).length }));
    const statusTotal = reservationStatuses.reduce((total, item) => total + item.count, 0);
    const occupancy = occupancyReport ? Math.round(occupancyReport.occupancyRate * 100) : null;

    return <section className="listing-section staff-dashboard-page">
        {error && <div className="alert error" role="alert">{error}</div>}
        <div className="staff-dashboard-heading">
            <div>
                <p className="eyebrow">STAFF WORKSPACE</p>
                <h1>Dashboard</h1>
                <p className="staff-manage-description">Welcome, {user ? `${user.first_name} ${user.last_name}`.trim() : "Staff"}. Here's what's happening across your properties.</p>
            </div>
            <span className="staff-dashboard-badge">{user?.role?.role_name ?? "Staff"}</span>
        </div>
        {loading && <p role="status">Loading dashboard…</p>}
        <div className="staff-dashboard-stats">
            <article className="staff-dashboard-stat">
                <p>HOTEL BOOKINGS</p>
                <span className="staff-stat-icon">🏨</span>
                <strong>{hotelReservations.filter(active).length}</strong>
                <small>{hotelReservations.length} total</small>
            </article>
            <article className="staff-dashboard-stat">
                <p>ROOM OCCUPANCY</p>
                <span className="staff-stat-icon">📊</span>
                <strong className="orange-stat">{occupancy === null ? "—" : `${occupancy}%`}</strong>
                <small>{occupancyReport ? `${occupancyReport.occupiedRooms}/${occupancyReport.totalRooms} rooms occupied` : "Reservation occupancy"}</small>
            </article>
            <article className="staff-dashboard-stat">
                <p>TABLE RESERVATIONS</p>
                <span className="staff-stat-icon">🍽️</span>
                <strong className="gold-stat">{diningReservations.filter(active).length}</strong>
                <small>{diningReservations.length} total</small>
            </article>
        </div>
        <section className="staff-dashboard-panel">
            <h2>Inventory Status</h2>
            <div className="staff-inventory-status-cards">
                {cards.map((card) => {
                    const counts = card.getStatusCounts();
                    return <article className="staff-dashboard-stat" key={card.resourceName}>
                        <h3>{card.resourceName}</h3>
                        <div className="staff-inventory-status-counts">
                            {Object.entries(counts).map(([status, count]) => <p key={status}><span>{status}</span><strong>{count}</strong></p>)}
                        </div>
                    </article>;
                })}
            </div>
        </section>
        <section className="staff-dashboard-panel">
            <h2>Reservation Status Breakdown</h2>
            <div className="staff-status-breakdown">
                {reservationStatuses.map((item) => {
                    const percentage = statusTotal ? Math.round((item.count / statusTotal) * 100) : 0;
                    return <div className="staff-status-item" key={item.label}>
                        <div className="staff-status-label"><span>{item.label}</span><strong>{item.count}</strong></div>
                        <div className="staff-status-track"><span className={item.className} style={{ width: `${percentage}%` }} /></div>
                        <small>{percentage}%</small>
                    </div>;
                })}
            </div>
        </section>
        <section className="staff-dashboard-panel">
            <h2>Recent Activity</h2>
            <div className="staff-activity-list">
                {recent.map((item) => {
                    const room = rooms.find((candidate) => candidate.room_id === item.room_id) ?? item.room;
                    const table = tables.find((candidate) => candidate.table_id === item.table_id) ?? item.restaurant_table;
                    const property = room?.hotel?.name ?? table?.restaurant?.name ?? "—";
                    const guest = item.user ? `${item.user.first_name} ${item.user.last_name}`.trim() || item.user.email : "—";
                    return <article key={item.reservation_id}>
                        <span className="staff-activity-icon">{item.reservation_type === "HOTEL" ? "🏨" : "🍽️"}</span>
                        <div><strong>{guest}</strong><p>{property}</p></div>
                        <span className={`staff-status ${item.status.toLowerCase()}`}>{item.status}</span>
                    </article>;
                })}
                {!items.length && !loading && <p>No recent reservations.</p>}
            </div>
        </section>
        {!data && !loading && !error && <p className="empty">No dashboard data.</p>}
    </section>;
}
