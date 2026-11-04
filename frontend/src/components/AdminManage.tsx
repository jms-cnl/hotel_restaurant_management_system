import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import { displayGuestCount } from "../adminBookings";
import { useAuth } from "../auth";
import { RESERVATION_STATUSES, type CombinedBooking, type Reservation, type RestaurantTable, type Room } from "../types";

type SectionKey = "roomReservations" | "tableReservations" | "combinedBookings";
type ChildReservation = Reservation & { room?: Room; restaurant_table?: RestaurantTable };
type BookingDetails = CombinedBooking & { reservation?: ChildReservation[] };
type DisplayRecord = {
    id: number;
    status: string;
    values: string[];
    searchValues: string[];
    booking?: CombinedBooking;
};

const pageSize = 5;

const guestName = (reservation: Reservation) => {
    const user = reservation.user;
    return user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "—";
};

const sectionDefinitions: Record<SectionKey, { label: string; description: string; columns: string[] }> = {
    roomReservations: {
        label: "Room Reservations",
        description: "Review and manage existing room reservation records.",
        columns: ["Reservation ID", "Customer", "Room", "Check-in Date", "Check-out Date", "Reservation Status"],
    },
    tableReservations: {
        label: "Table Reservations",
        description: "Manage existing restaurant reservations and guest schedules.",
        columns: ["Reservation ID", "Customer", "Table", "Number of Guests", "Reservation Date", "Reservation Time", "Reservation Status"],
    },
    combinedBookings: {
        label: "Combined Bookings",
        description: "Review and manage existing bookings that include a room and restaurant table.",
        columns: ["Booking ID", "Customer", "Room Reservation", "Table Reservation", "Booking Schedule", "Booking Status"],
    },
};

const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function AdminManage() {
    const { user } = useAuth();
    const isAdmin = user?.role?.role_name === "Admin";
    const [activeSection, setActiveSection] = useState<SectionKey>("roomReservations");
    const [roomReservations, setRoomReservations] = useState<Reservation[]>([]);
    const [tableReservations, setTableReservations] = useState<Reservation[]>([]);
    const [combinedBookings, setCombinedBookings] = useState<CombinedBooking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [userCount, setUserCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Statuses");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<BookingDetails | Reservation | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        let active = true;
        const requests: Promise<unknown>[] = [
            apiGet<Reservation[]>("/reservations?type=HOTEL").then(value => { if (active) setRoomReservations(value); }),
            apiGet<Reservation[]>("/reservations?type=RESTAURANT").then(value => { if (active) setTableReservations(value); }),
            apiGet<CombinedBooking[]>("/combined-bookings").then(value => { if (active) setCombinedBookings(value); }),
            apiGet<Room[]>("/rooms").then(value => { if (active) setRooms(value); }),
            apiGet<RestaurantTable[]>("/tables").then(value => { if (active) setTables(value); }),
        ];
        if (isAdmin) requests.push(apiGet<{ user_id: string }[]>("/admin/users").then(value => { if (active) setUserCount(value.length); }));

        void Promise.allSettled(requests).then(results => {
            if (!active) return;
            const failed = results.find(result => result.status === "rejected");
            if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "Unable to load booking records.");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [isAdmin]);

    const roomMap = useMemo(() => new Map(rooms.map(room => [room.room_id, room])), [rooms]);
    const tableMap = useMemo(() => new Map(tables.map(table => [table.table_id, table])), [tables]);

    const records = useMemo<DisplayRecord[]>(() => {
        if (activeSection === "roomReservations") return roomReservations.map(item => {
            const room = item.room ?? roomMap.get(Number(item.room_id));
            const values = [String(item.reservation_id), guestName(item), room?.room_number ?? text(item.room_id), text(item.check_in_date?.slice(0, 10)), text(item.check_out_date?.slice(0, 10)), item.status];
            return { id: item.reservation_id, status: item.status, values, searchValues: values };
        });
        if (activeSection === "tableReservations") return tableReservations.map(item => {
            const table = item.restaurant_table ?? tableMap.get(Number(item.table_id));
            const values = [String(item.reservation_id), guestName(item), table?.table_number ?? text(item.table_id), displayGuestCount(undefined), text(item.reservation_date?.slice(0, 10)), text(item.start_time?.slice(0, 5)), item.status];
            return { id: item.reservation_id, status: item.status, values, searchValues: values };
        });
        return combinedBookings.map(booking => {
            const hotel = booking.reservation?.find(reservation => reservation.reservation_type === "HOTEL" || reservation.room_id != null);
            const restaurant = booking.reservation?.find(reservation => reservation.reservation_type === "RESTAURANT" || reservation.table_id != null);
            const room = hotel?.room ?? (hotel?.room_id ? roomMap.get(Number(hotel.room_id)) : undefined);
            const table = restaurant?.restaurant_table ?? (restaurant?.table_id ? tableMap.get(Number(restaurant.table_id)) : undefined);
            const customer = booking.user ? `${booking.user.first_name} ${booking.user.last_name}`.trim() || booking.user.email : "—";
            const roomLabel = hotel ? `#${hotel.reservation_id}${room ? ` · ${room.room_number}` : ""}` : "—";
            const tableLabel = restaurant ? `#${restaurant.reservation_id}${table ? ` · ${table.table_number}` : ""}` : "—";
            const schedule = [hotel?.check_in_date?.slice(0, 10), hotel?.check_out_date?.slice(0, 10), restaurant?.reservation_date?.slice(0, 10)]
                .filter(Boolean).join(" · ") || "—";
            const values = [String(booking.combined_booking_id), customer, roomLabel, tableLabel, schedule, booking.status];
            return { id: booking.combined_booking_id, status: booking.status, values, searchValues: values, booking };
        });
    }, [activeSection, roomReservations, tableReservations, combinedBookings, roomMap, tableMap]);

    const filteredRecords = useMemo(() => records.filter(record => {
        const query = search.trim().toLocaleLowerCase();
        const matchesSearch = !query || record.searchValues.some(value => value.toLocaleLowerCase().includes(query));
        return matchesSearch && (statusFilter === "All Statuses" || record.status === statusFilter);
    }), [records, search, statusFilter]);
    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visibleRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const changeSection = (section: SectionKey) => {
        setActiveSection(section);
        setSearch("");
        setStatusFilter("All Statuses");
        setPage(1);
    };

    const openRecord = async (record: DisplayRecord) => {
        setError("");
        setDetailLoading(true);
        if (activeSection !== "combinedBookings") {
            const source = activeSection === "roomReservations" ? roomReservations : tableReservations;
            setSelected(source.find(item => item.reservation_id === record.id) ?? null);
            setDetailLoading(false);
            return;
        }
        if (!record.booking) return;
        try {
            const reservations = await apiGet<ChildReservation[]>(`/combined-bookings/${record.id}/reservations`);
            setSelected({ ...record.booking, reservation: reservations });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load booking details.");
            setSelected(record.booking);
        } finally {
            setDetailLoading(false);
        }
    };

    const section = sectionDefinitions[activeSection];
    const summaryCards = [
        { label: "Total Rooms", value: rooms.length },
        { label: "Total Tables", value: tables.length },
        { label: "Room Reservations", value: roomReservations.length },
        { label: "Table Reservations", value: tableReservations.length },
        { label: "Combined Bookings", value: combinedBookings.length },
        ...(isAdmin ? [{ label: "Users", value: userCount ?? "—" }] : []),
    ];

    return <div className="admin-crud-page">
        {error && <div className="admin-crud-form-error" role="alert">{error}</div>}
        <div className="admin-crud-summary">
            {summaryCards.map(card => <div className="admin-crud-summary-card" key={card.label}><span>{card.label}</span><strong>{card.value}</strong></div>)}
        </div>
        <div className="admin-crud-tabs" role="tablist" aria-label="Admin booking sections">
            {(Object.keys(sectionDefinitions) as SectionKey[]).map(key => <button key={key} type="button" role="tab" aria-selected={activeSection === key} className={activeSection === key ? "active" : ""} onClick={() => changeSection(key)}>
                {sectionDefinitions[key].label}<span>{key === "roomReservations" ? roomReservations.length : key === "tableReservations" ? tableReservations.length : combinedBookings.length}</span>
            </button>)}
        </div>
        <div className="admin-crud-panel">
            <div className="admin-crud-section-heading"><div><h2>{section.label}</h2><p>{section.description}</p></div></div>
            <div className="admin-crud-toolbar">
                <input type="search" value={search} placeholder={`Search ${section.label.toLowerCase()}...`} aria-label={`Search ${section.label}`} onChange={event => { setSearch(event.target.value); setPage(1); }} />
                <select aria-label="Filter by status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}>
                    <option value="All Statuses">All Statuses</option>
                    {RESERVATION_STATUSES.map(status => <option value={status} key={status}>{status}</option>)}
                </select>
                <span className="admin-crud-result-count">{filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}</span>
            </div>
            <div className="admin-crud-table-wrap">
                {loading ? <div className="admin-crud-empty"><h3>Loading {section.label.toLowerCase()}...</h3></div> : visibleRecords.length === 0 ? <div className="admin-crud-empty"><span aria-hidden="true">⌕</span><h3>No records found</h3><p>{records.length === 0 ? `There are no ${section.label.toLowerCase()} yet.` : "Try changing your search or status filter."}</p></div> : <table className="admin-crud-table">
                    <thead><tr>{section.columns.map(column => <th key={column}>{column}</th>)}<th className="admin-crud-actions-heading">Actions</th></tr></thead>
                    <tbody>{visibleRecords.map(record => <tr key={record.id}>{record.values.map((value, index) => <td key={`${record.id}-${index}`}>{index === record.values.length - 1 ? <span className={`admin-crud-status ${statusClass(value)}`}>{value}</span> : value}</td>)}<td><div className="admin-crud-row-actions"><button type="button" className="admin-crud-view" onClick={() => void openRecord(record)}>View</button></div></td></tr>)}</tbody>
                </table>}
            </div>
            {filteredRecords.length > 0 && <div className="admin-crud-pagination"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}</span><div>
                <button type="button" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next</button>
            </div></div>}
        </div>
        {selected && <div className="admin-crud-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
            <section className="admin-crud-modal" role="dialog" aria-modal="true" aria-labelledby="admin-manage-modal-title">
                <div className="admin-crud-modal-head"><div><p className="eyebrow">ADMIN MANAGEMENT</p><h2 id="admin-manage-modal-title">{activeSection === "combinedBookings" ? "Combined Booking Details" : `${section.label.replace(/s$/, "")} Details`}</h2></div><button type="button" aria-label="Close dialog" onClick={() => setSelected(null)}>×</button></div>
                {detailLoading ? <div className="admin-crud-empty" role="status">Loading booking details…</div> : <div className="admin-crud-details">
                    {"reservation_id" in selected ? <>
                        <DetailRow label="Reservation ID" value={selected.reservation_id} />
                        <DetailRow label="Customer" value={guestName(selected)} />
                        <DetailRow label={selected.reservation_type === "HOTEL" ? "Room" : "Table"} value={selected.reservation_type === "HOTEL" ? selected.room?.room_number ?? selected.room_id : selected.restaurant_table?.table_number ?? selected.table_id} />
                        {selected.reservation_type === "HOTEL" ? <><DetailRow label="Check-in Date" value={selected.check_in_date?.slice(0, 10)} /><DetailRow label="Check-out Date" value={selected.check_out_date?.slice(0, 10)} /></> : <><DetailRow label="Number of Guests" value={displayGuestCount(undefined)} /><DetailRow label="Reservation Date" value={selected.reservation_date?.slice(0, 10)} /><DetailRow label="Reservation Time" value={selected.start_time?.slice(0, 5)} /></>}
                        <DetailRow label="Reservation Status" value={selected.status} isStatus />
                    </> : <>
                        <DetailRow label="Booking ID" value={selected.combined_booking_id} />
                        <DetailRow label="Customer" value={selected.user ? `${selected.user.first_name} ${selected.user.last_name}`.trim() || selected.user.email : "—"} />
                        {(selected.reservation ?? []).map((child, index) => <div key={child.reservation_id}>
                            <DetailRow label={child.reservation_type === "HOTEL" ? "Room Reservation" : "Table Reservation"} value={`#${child.reservation_id}`} />
                            {child.reservation_type === "HOTEL" ? <><DetailRow label="Room" value={child.room?.room_number ?? child.room_id} /><DetailRow label="Check-in Date" value={child.check_in_date?.slice(0, 10)} /><DetailRow label="Check-out Date" value={child.check_out_date?.slice(0, 10)} /></> : <><DetailRow label="Table" value={child.restaurant_table?.table_number ?? child.table_id} /><DetailRow label="Number of Guests" value={displayGuestCount(undefined)} /><DetailRow label="Reservation Date" value={child.reservation_date?.slice(0, 10)} /><DetailRow label="Reservation Time" value={child.start_time?.slice(0, 5)} /></>}
                            {index === 0 && <hr />}
                        </div>)}
                        <DetailRow label="Booking Status" value={selected.status} isStatus />
                    </>}
                </div>}
                <div className="admin-crud-form-actions"><button type="button" className="admin-crud-cancel" onClick={() => setSelected(null)}>Close</button></div>
            </section>
        </div>}
    </div>;
}

function DetailRow({ label, value, isStatus = false }: { label: string; value: unknown; isStatus?: boolean }) {
    const display = text(value);
    return <div className="admin-crud-detail-row"><span>{label}</span><strong>{isStatus ? <span className={`admin-crud-status ${statusClass(display)}`}>{display}</span> : display}</strong></div>;
}
