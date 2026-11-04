import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../api";
import { dashboardReservationReportPath, formatOccupancyRate } from "../adminBookings";
import { useAuth } from "../auth";

type RoomOccupancyReport = {
    totalRooms: number;
    occupiedRooms: number;
    occupancyRate: number;
};

type ReservationReport = {
    summary: { totalReservations: number };
};

type RevenueReport = {
    totalRevenue: number;
};

type AdminUser = {
    user_id: string;
};

type NotificationItem = {
    notification_id: number;
    title: string;
    message: string;
    created_at: string;
    is_read: boolean;
};

const dashboardDescription = "Operational overview for Serenity Hotel and its in-house restaurant.";

const money = (value: number) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
}).format(value);

export function AdminDashboard() {
    const { user } = useAuth();
    const isAdmin = user?.role?.role_name === "Admin";
    const [occupancyReport, setOccupancyReport] = useState<RoomOccupancyReport | null>(null);
    const [hotelReservationCount, setHotelReservationCount] = useState<number | null>(null);
    const [tableReservationCount, setTableReservationCount] = useState<number | null>(null);
    const [revenue, setRevenue] = useState<number | null>(null);
    const [registeredUsers, setRegisteredUsers] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const requests: Array<Promise<void>> = [
            apiGet<RoomOccupancyReport>("/reports/occupancy").then(value => { if (active) setOccupancyReport(value); }),
            apiGet<ReservationReport>(dashboardReservationReportPath("HOTEL")).then(value => {
                if (active) setHotelReservationCount(value.summary.totalReservations);
            }),
            apiGet<ReservationReport>(dashboardReservationReportPath("RESTAURANT")).then(value => {
                if (active) setTableReservationCount(value.summary.totalReservations);
            }),
        ];
        if (isAdmin) {
            requests.push(
                apiGet<RevenueReport>("/reports/revenue").then(value => { if (active) setRevenue(value.totalRevenue); }),
                apiGet<AdminUser[]>("/admin/users").then(value => { if (active) setRegisteredUsers(value.length); }),
            );
        }

        void Promise.allSettled(requests).then(results => {
            if (!active) return;
            const failed = results.find(result => result.status === "rejected");
            if (failed?.status === "rejected") {
                setError(failed.reason instanceof Error ? failed.reason.message : "Some dashboard data could not be loaded.");
            }
        }).finally(() => {
            if (active) setLoading(false);
        });

        return () => { active = false; };
    }, [isAdmin]);

    const occupancy = occupancyReport ? formatOccupancyRate(occupancyReport.occupancyRate) : "—";
    const cards = [
        {
            label: "Room Occupancy",
            value: occupancy,
            note: occupancyReport ? `${occupancyReport.occupiedRooms} of ${occupancyReport.totalRooms} rooms occupied` : "Current room occupancy",
        },
        {
            label: "Room Reservations",
            value: hotelReservationCount === null ? "—" : String(hotelReservationCount),
            note: "Reservations this month",
        },
        {
            label: "Table Reservations",
            value: tableReservationCount === null ? "—" : String(tableReservationCount),
            note: "Dining reservations this month",
        },
        ...(isAdmin ? [
            { label: "Revenue Overview", value: revenue === null ? "—" : money(revenue), note: "Recorded hotel revenue" },
            { label: "Registered Users", value: registeredUsers === null ? "—" : String(registeredUsers), note: "Registered accounts" },
        ] : []),
    ];

    return <section className="listing-section admin-page">
        <div className="admin-page-heading">
            <div>
                <p className="eyebrow">SERENITY HOTEL &amp; RESTAURANT</p>
                <h1>Dashboard</h1>
                <p className="staff-manage-description">{dashboardDescription}</p>
            </div>
            <span className="staff-dashboard-badge">{user?.role?.role_name ?? "Staff"}</span>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        {loading && <p role="status">Loading dashboard…</p>}
        <div className={`admin-stat-grid${isAdmin ? "" : " staff-view"}`}>
            {cards.map(card => <article className="admin-stat-card" key={card.label}>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
            </article>)}
        </div>
        <div className="admin-panel">
            <h2>Recent Operations</h2>
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead><tr><th>Activity</th><th>Date &amp; Time</th><th>Status</th></tr></thead>
                    <tbody><tr><td colSpan={3}><div className="admin-empty">
                        <span aria-hidden="true">—</span>
                        <strong>No recent operations available.</strong>
                        <p>The backend does not provide an operations activity feed.</p>
                    </div></td></tr></tbody>
                </table>
            </div>
        </div>
    </section>;
}

export function AdminNotifications() {
    const { user } = useAuth();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            setItems(await apiGet<NotificationItem[]>("/notifications"));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load notifications.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const markDisplayedAsRead = async () => {
        const unread = items.filter(item => !item.is_read);
        if (!unread.length) return;
        setSaving(true);
        setError("");
        try {
            await Promise.all(unread.map(item => apiPatch<NotificationItem>(`/notifications/${item.notification_id}/read`, {})));
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to mark notifications as read.");
        } finally {
            setSaving(false);
        }
    };

    return <section className="listing-section admin-page">
        <div className="admin-page-heading">
            <div>
                <p className="eyebrow">SERENITY HOTEL &amp; RESTAURANT</p>
                <h1>Notifications</h1>
                <p className="staff-manage-description">System events and updates for this account.</p>
            </div>
            <span className="staff-dashboard-badge">{user?.role?.role_name ?? "Admin"}</span>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <div className="admin-panel">
            <div className="admin-toolbar">
                <p>{items.some(item => !item.is_read) ? "You have unread notifications." : "All displayed notifications are read."}</p>
                <button type="button" className="admin-secondary-button" disabled={saving || loading || !items.some(item => !item.is_read)} onClick={() => void markDisplayedAsRead()}>
                    {saving ? "Marking as read…" : "Mark displayed as read"}
                </button>
            </div>
            {loading ? <div className="admin-empty" role="status">Loading notifications…</div> : items.length ? <div className="profile-activity-list">
                {items.map(item => <article key={item.notification_id}>
                    <span className="profile-activity-icon">N</span>
                    <div>
                        <h3>{item.title}</h3>
                        <p>{item.message} · {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</p>
                    </div>
                    <span className="profile-activity-status">{item.is_read ? "Read" : "New"}</span>
                </article>)}
            </div> : <div className="admin-empty">
                <span aria-hidden="true">—</span>
                <strong>No notifications available.</strong>
                <p>Notifications for this account will appear here.</p>
            </div>}
        </div>
    </section>;
}
