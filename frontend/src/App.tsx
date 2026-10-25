import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload, setToken } from "./api";
import { useAuth } from "./auth";
import { CustomerHome } from "./components/CustomerHome";
import { CustomerLayout } from "./components/CustomerLayout";
import { HotelDetails } from "./components/HotelDetails";
import { HotelDiscovery } from "./components/HotelDiscovery";
import { RestaurantDetails } from "./components/RestaurantDetails";
import { RestaurantDiscovery } from "./components/RestaurantDiscovery";
import { CustomerReservations } from "./components/CustomerReservations";
import { CustomerCombinedBookings } from "./components/CustomerCombinedBookings";
import { buildCombinedBookingPayload } from "./customerData";
import { passwordErrors, passwordRequirements } from "./passwordPolicy";
import type { CombinedBooking, Hotel, Media, Reservation, ReservationHistory, Restaurant, RestaurantTable, Room, User } from "./types";

const role = (user: User | null) => user?.role?.role_name ?? "Customer";
const isManager = (user: User | null) => ["Admin", "Staff"].includes(role(user));
const isAdmin = (user: User | null) => role(user) === "Admin";
const canCreateReservations = (user: User | null) => ["Customer", "Staff", "Admin"].includes(role(user));
const landingPath = (user: User | null) => isManager(user) ? "/dashboard" : "/home";

function Protected({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) return <main className="center">Loading session...</main>;
    return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
    const { user } = useAuth();
    return roles.includes(role(user)) ? <>{children}</> : <Navigate to="/home" replace />;
}

function AppLayout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    if (!isManager(user)) return <CustomerLayout>{children}</CustomerLayout>;
    const staffName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
    return <div className="manager-app customer-app">
        <header className="customer-navbar">
            <Link to="/dashboard" className="customer-logo">
                <span className="customer-logo-icon">L</span>
                <span>StayEase</span>
            </Link>
            <nav className="customer-nav-links">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/hotels">Hotels &amp; Restaurants</NavLink>
                <NavLink to="/reservations">Reservations</NavLink>
                <NavLink to="/manage">Manage</NavLink>
                <NavLink to="/restaurants">Restaurants</NavLink>
                <NavLink to="/rooms">Rooms</NavLink>
                <NavLink to="/tables">Tables</NavLink>
                <NavLink to="/combined-bookings">Combined Bookings</NavLink>
                <NavLink to="/reports">Reports</NavLink>
                <NavLink to="/notifications">Notifications</NavLink>
                {isAdmin(user) && <NavLink to="/users">Users</NavLink>}
            </nav>
            <div className="customer-nav-actions">
                <NavLink to="/profile" className="customer-profile-link">
                    {staffName}<span className="staff-role-label">{role(user)}</span>
                </NavLink>
                <NavLink to="/profile" className="customer-profile-link">My Profile</NavLink>
                <button type="button" className="customer-signout-button" onClick={async () => { await logout(); navigate("/login"); }}>
                    Sign Out
                </button>
            </div>
        </header>
        <main className="customer-main">{children}</main>
    </div>;
}

function Page({ title, children, error, loading }: { title: string; children: ReactNode; error?: string; loading?: boolean }) {
    return <section><div className="page-heading"><h1>{title}</h1></div>{error && <div className="alert error">{error}</div>}{loading ? <p>Loading...</p> : children}</section>;
}

function PasswordRequirements({ password }: { password: string }) {
    const errors = passwordErrors(password);
    return <div className="password-guidance"><strong>Password must contain:</strong><ul>{passwordRequirements.map(requirement => <li className={errors.includes(requirement) ? "requirement-missing" : "requirement-met"} key={requirement}>{requirement}</li>)}</ul></div>;
}

function AuthPage({ registerMode = false }: { registerMode?: boolean }) {
    const { user, login, register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "" });
    const [error, setError] = useState("");
    if (user) return <Navigate to={landingPath(user)} replace />;
    const submit = async (event: FormEvent) => {
        event.preventDefault(); setError("");
        try {
            if (registerMode && passwordErrors(form.password).length) throw new Error(`Password does not meet the requirements: ${passwordErrors(form.password).join(", ")}`);
            if (registerMode) { await register(form); navigate("/"); }
            else { await login(form.email, form.password); navigate("/"); }
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Request failed"); }
    };
    return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
        <Link to="/login" className="auth-brand">StayEase</Link>
        <p className="auth-eyebrow">{registerMode ? "START YOUR NEXT GETAWAY" : "WELCOME BACK"}</p>
        <h1>{registerMode ? "Create your account" : "Log in to StayEase"}</h1>
        <p className="auth-description">{registerMode ? "Create an account to manage reservations." : "Access your reservations and account."}</p>
        {error && <div className="alert error" role="alert">{error}</div>}
        <div className="auth-form">
            {registerMode && <><label>First name<input autoComplete="given-name" required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label>Last name<input autoComplete="family-name" required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label><label>Phone<input autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label></>}
            <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label>Password<input type="password" autoComplete={registerMode ? "new-password" : "current-password"} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
            {registerMode && <PasswordRequirements password={form.password} />}
            {!registerMode && <Link to="/forgot-password" className="auth-home-link">Forgot password?</Link>}
            <button className="auth-button" type="submit">{registerMode ? "Create account" : "Log in"}</button>
        </div>
        <p className="auth-switch">{registerMode ? "Already registered? " : "Need an account? "}<Link to={registerMode ? "/login" : "/register"}>{registerMode ? "Sign in" : "Register"}</Link></p>
    </form></main>;
}

function Dashboard() {
    const [data, setData] = useState<Record<string, number> | null>(null); const [error, setError] = useState("");
    useEffect(() => { apiGet<Record<string, number>>("/dashboard").then(setData).catch(e => setError(e.message)); }, []);
    return <Page title="Dashboard" error={error}>{data ? <section className="manager-dashboard">
        <div className="manager-dashboard-stats">
            {[
                { label: "Hotels", value: data.hotels },
                { label: "Restaurants", value: data.restaurants },
                { label: "Rooms", value: data.rooms, detail: `${data.availableRooms} available` },
                { label: "Tables", value: data.tables, detail: `${data.availableTables} available` },
                { label: "Reservations", value: data.reservations },
                { label: "Combined bookings", value: data.combinedBookings, detail: `${data.completedCombinedBookings} completed` },
                { label: "Notifications", value: data.notifications, detail: `${data.unreadNotifications} unread` }
            ].map(item => <article className="manager-dashboard-stat" key={item.label}>
                <span>{item.label}</span><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}
            </article>)}
        </div>
        <section className="manager-dashboard-panel">
            <h2>Reservation status counts</h2>
            <div className="manager-dashboard-status-list">
                {[
                    { label: "Confirmed", value: data.confirmedReservations },
                    { label: "Pending", value: data.pendingReservations },
                    { label: "Cancelled", value: data.cancelledReservations }
                ].map(item => <div className="manager-dashboard-status-item" key={item.label}>
                    <span>{item.label}</span><strong>{item.value}</strong>
                </div>)}
            </div>
        </section>
    </section> : !error && <p>Loading...</p>}</Page>;
}

function Home() {
    return <CustomerHome />;
}

function HotelCatalogRoute() {
    const { user } = useAuth();
    return isManager(user) ? <ResourcePage kind="hotels" /> : <HotelDiscovery />;
}

function RestaurantCatalogRoute() {
    const { user } = useAuth();
    return isManager(user) ? <ResourcePage kind="restaurants" /> : <RestaurantDiscovery />;
}

function ReservationsRoute() {
    const { user } = useAuth();
    return isManager(user) ? <Reservations /> : <CustomerReservations />;
}

function CombinedBookingsRoute() {
    const { user } = useAuth();
    return isManager(user) ? <CombinedBookings /> : <CustomerCombinedBookings />;
}

function Notifications() {
    const { user } = useAuth();
    const manager = isManager(user);
    const [items, setItems] = useState<Record<string, unknown>[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
    const load = () => { setLoading(true); return apiGet<Record<string, unknown>[]>("/notifications").then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false)); };
    useEffect(() => { void load(); }, []);
    const markRead = async (id: number) => { try { await apiPatch(`/notifications/${id}/read`, {}); load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update notification"); } };
    return <Page title="Notifications" error={error} loading={loading}>{items.length ? <div className={manager ? "detail manager-notifications" : "detail"}><ul>{items.map(item => <li key={String(item.notification_id)}><strong>{String(item.title)}</strong>: {String(item.message)} <small>{item.created_at ? new Date(String(item.created_at)).toLocaleString() : ""}</small> {Boolean(item.is_read) ? <span>Read</span> : <button onClick={() => markRead(Number(item.notification_id))}>Mark read</button>}</li>)}</ul></div> : <p className={manager ? "empty manager-notifications-empty" : "empty"}>No notifications.</p>}</Page>;
}

function Users() {
    return <Page title="Users"><div className="detail"><p>User management is reserved for Admin users. The current backend exposes profile management only; administrative user CRUD is not yet available.</p></div></Page>;
}

function ForgotPassword() {
    const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
    const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(""); setMessage(""); try { const result = await apiPost<{ message: string }>("/auth/forgot-password", { email }); setMessage(result.message); } catch (e) { setError(e instanceof Error ? e.message : "Unable to request password reset"); } finally { setLoading(false); } };
    return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Link to="/login" className="auth-brand">StayEase</Link><p className="auth-eyebrow">ACCOUNT RECOVERY</p><h1>Forgot password?</h1><p className="auth-description">Enter your account email and we’ll send a recovery link.</p>{error && <div className="alert error" role="alert">{error}</div>}{message && <div className="alert success" role="status">{message}</div>}<div className="auth-form"><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className="auth-button" disabled={loading} type="submit">{loading ? "Sending…" : "Send reset link"}</button><Link className="auth-home-link" to="/login">Back to login</Link></div></form></main>;
}

function ResetPassword() {
    const navigate = useNavigate(); const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true);
    useEffect(() => { const params = new URLSearchParams(window.location.hash.replace(/^#/, "")); const accessToken = params.get("access_token"); if (!accessToken || params.get("type") !== "recovery") setError("This password reset link is invalid or expired."); else setToken(accessToken); setLoading(false); }, []);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (passwordErrors(newPassword).length) { setError(`Password does not meet the requirements: ${passwordErrors(newPassword).join(", ")}`); return; } if (newPassword !== confirmPassword) { setError("Password confirmation does not match"); return; } setLoading(true); try { const result = await apiPost<{ message: string }>("/auth/reset-password", { new_password: newPassword }); setMessage(result.message); setToken(null); } catch (e) { setError(e instanceof Error ? e.message : "Reset session is invalid or expired"); } finally { setLoading(false); } };
    return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Link to="/login" className="auth-brand">StayEase</Link><p className="auth-eyebrow">ACCOUNT RECOVERY</p><h1>Set a new password</h1>{error && <div className="alert error" role="alert">{error}</div>}{message ? <><div className="alert success" role="status">{message}</div><button className="auth-button" type="button" onClick={() => navigate("/login")}>Back to login</button></> : <>{!loading && <div className="auth-form"><label>New password<input type="password" autoComplete="new-password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><PasswordRequirements password={newPassword} /><label>Confirm password<input type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label><button className="auth-button" disabled={loading} type="submit">Update password</button></div>}</>}</form></main>;
}

function LandingRedirect() {
    const { user } = useAuth();
    return <Navigate to={landingPath(user)} replace />;
}

type ResourceConfig = { title: string; endpoint: string; id: string; fields: string[]; search?: string };
const resourceConfigs: Record<keyof typeof mediaEntityTypes, ResourceConfig> = {
    hotels: { title: "Hotels", endpoint: "/hotels", id: "hotel_id", fields: ["name", "address", "description", "contact_number", "email", "status"], search: "search" },
    restaurants: { title: "Restaurants", endpoint: "/restaurants", id: "restaurant_id", fields: ["name", "address", "description", "contact_number", "email", "status"], search: "search" },
    rooms: { title: "Rooms", endpoint: "/rooms", id: "room_id", fields: ["hotel_id", "room_number", "room_type", "capacity", "price_per_night", "status"] },
    tables: { title: "Tables", endpoint: "/tables", id: "table_id", fields: ["restaurant_id", "table_number", "capacity", "status"] }
};

const mediaEntityTypes = { hotels: "hotel", restaurants: "restaurant", rooms: "room", tables: "table" } as const;

function MediaManager({ entityType, entityId, manager }: { entityType: keyof typeof mediaEntityTypes; entityId: number; manager: boolean }) {
    const [items, setItems] = useState<Media[]>([]); const [file, setFile] = useState<File | null>(null); const [error, setError] = useState(""); const [message, setMessage] = useState("");
    const load = () => apiGet<Media[]>(`/media/${mediaEntityTypes[entityType]}/${entityId}`).then(setItems).catch(e => setError(e.message));
    useEffect(() => { setError(""); setMessage(""); load(); }, [entityType, entityId]);
    const upload = async (event: FormEvent) => { event.preventDefault(); if (!file) return; setError(""); try { await apiUpload(`/media/${mediaEntityTypes[entityType]}/${entityId}`, file); setFile(null); setMessage("Image uploaded"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); } };
    const replace = async (mediaId: number, replacement: File | undefined) => { if (!replacement) return; try { await apiUpload(`/media/${mediaId}/file`, replacement, {}, "PUT"); setMessage("Image replaced"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Replace failed"); } };
    const primary = async (mediaId: number) => { try { await apiPatch(`/media/${mediaId}/primary`, {}); setMessage("Primary image updated"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Primary image update failed"); } };
    const reorder = async (media: Media, value: string) => { try { await apiPatch(`/media/${media.media_id}/order`, { display_order: Number(value) }); setMessage("Image order updated"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Order update failed"); } };
    const remove = async (mediaId: number) => { if (!confirm("Delete this image?")) return; try { await apiDelete(`/media/${mediaId}`); setMessage("Image deleted"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); } };
    return <div className="media-manager"><h3>Images</h3>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}{items.length ? <div className="media-grid">{items.map(media => <div className="media-item" key={media.media_id}><img src={media.url} alt={`${media.image_type} media`} /><div><strong>{media.is_primary ? "Primary image" : "Image"}</strong><span>Order: {media.display_order}</span></div>{manager && <div className="media-actions"><button onClick={() => primary(media.media_id)} disabled={media.is_primary}>Set primary</button><label>Replace<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => replace(media.media_id, e.target.files?.[0])} /></label><label>Order<input type="number" min="0" defaultValue={media.display_order} onBlur={e => reorder(media, e.target.value)} /></label><button onClick={() => remove(media.media_id)}>Delete</button></div>}</div>)}</div> : <p className="empty">No images available.</p>}{manager && <form className="media-upload" onSubmit={upload}><label>Upload image<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><button type="submit">Upload</button></form>}</div>;
}

function ResourcePage({ kind }: { kind: keyof typeof mediaEntityTypes }) {
    const config = resourceConfigs[kind]; const { user } = useAuth(); const manager = isManager(user); const [mediaEntity, setMediaEntity] = useState<number | null>(null);
    const [items, setItems] = useState<Record<string, unknown>[]>([]); const [form, setForm] = useState<Record<string, string>>({}); const [editing, setEditing] = useState<number | null>(null); const [filter, setFilter] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
    const load = () => { setLoading(true); const query = config.search && filter ? `?${config.search}=${encodeURIComponent(filter)}` : ""; apiGet<Record<string, unknown>[]>(`${config.endpoint}${query}`).then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false)); };
    useEffect(load, [filter]);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { const payload: Record<string, unknown> = { ...form }; for (const field of ["hotel_id", "restaurant_id", "capacity", "price_per_night"]) if (payload[field] !== undefined && payload[field] !== "") payload[field] = Number(payload[field]); if (editing) await apiPut(`${config.endpoint}/${editing}`, payload); else await apiPost(config.endpoint, payload); setForm({}); setEditing(null); load(); } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); } };
    const remove = async (id: number) => { if (!confirm("Delete this record?")) return; try { await apiDelete(`${config.endpoint}/${id}`); load(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); } };
    return <Page title={config.title} error={error} loading={loading}><div className="toolbar">{config.search && <input placeholder="Search" value={filter} onChange={e => setFilter(e.target.value)} />}</div><div className="table-wrap"><table><thead><tr>{config.fields.map(field => <th key={field}>{field}</th>)}<th>Media</th>{manager && <th>Actions</th>}</tr></thead><tbody>{items.map(item => <tr key={String(item[config.id])}>{config.fields.map(field => <td key={field}>{String(item[field] ?? "")}</td>)}<td><button onClick={() => setMediaEntity(Number(item[config.id]))}>View images</button></td>{manager && <td><button onClick={() => { setEditing(Number(item[config.id])); setForm(Object.fromEntries(config.fields.map(field => [field, String(item[field] ?? "")]))); }}>Edit</button> <button onClick={() => remove(Number(item[config.id]))}>Delete</button></td>}</tr>)}</tbody></table>{!items.length && <p className="empty">No records found.</p>}</div>{mediaEntity !== null && <MediaManager entityType={kind} entityId={mediaEntity} manager={manager} />}{manager && <form className="form-panel inline-form" onSubmit={submit}><h2>{editing ? `Edit ${config.title.slice(0, -1)}` : `Add ${config.title.slice(0, -1)}`}</h2>{config.fields.map(field => <label key={field}>{field}<input required={!field.includes("description") && field !== "email"} value={form[field] ?? ""} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}<button type="submit">Save</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm({}); }}>Cancel</button>}</form>}</Page>;
}

function Reservations() {
    const { user } = useAuth(); const manager = isManager(user); const [items, setItems] = useState<Reservation[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [tables, setTables] = useState<RestaurantTable[]>([]); const [selected, setSelected] = useState<Reservation | null>(null); const [history, setHistory] = useState<ReservationHistory[]>([]); const [type, setType] = useState("HOTEL"); const [statusFilter, setStatusFilter] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");
    const [form, setForm] = useState<Record<string, string>>({});
    const load = () => apiGet<Reservation[]>(`/reservations${statusFilter ? `?status=${statusFilter}` : ""}`).then(setItems).catch(e => setError(e.message));
    useEffect(() => { load(); apiGet<Room[]>("/rooms").then(setRooms).catch(() => undefined); apiGet<RestaurantTable[]>("/tables").then(setTables).catch(() => undefined); }, [statusFilter]);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); try { await apiPost("/reservations", { ...form, reservation_type: type, room_id: type === "HOTEL" ? Number(form.room_id) : null, table_id: type === "RESTAURANT" ? Number(form.table_id) : null }); setForm({}); setMessage("Reservation created"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Reservation failed"); } };
    const show = async (item: Reservation) => { setSelected(item); try { setHistory(await apiGet<ReservationHistory[]>(`/reservations/${item.reservation_id}/history`)); } catch (e) { setError(e instanceof Error ? e.message : "History failed"); } };
    const status = async (item: Reservation, next: string) => { try { await apiPatch(`/reservations/${item.reservation_id}/status`, { status: next }); setMessage("Status updated"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Status update failed"); } };
    return <Page title="Reservations" error={error}>{message && <div className="alert success">{message}</div>}<div className="toolbar"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All statuses</option>{["Pending", "Confirmed", "Rejected", "Completed", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></div><div className="manager-reservations-table-wrap"><table className="manager-reservations-table"><thead><tr><th>Reservation</th><th>Guest</th><th>Property</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item => { const room = rooms.find(r => r.room_id === item.room_id); const table = tables.find(t => t.table_id === item.table_id); return <tr key={item.reservation_id}><td><strong>#{item.reservation_id}</strong><small>{item.reservation_type}</small></td><td>{item.user ? `${item.user.first_name} ${item.user.last_name}` : "—"}</td><td><strong>{room?.hotel?.name ?? table?.restaurant?.name ?? "—"}</strong><small>{room ? `Room ${room.room_number}` : table ? `Table ${table.table_number}` : "—"}</small></td><td>{item.reservation_type === "HOTEL" ? item.check_in_date ?? "—" : item.reservation_date ?? "—"}<small>{item.reservation_type === "HOTEL" ? item.check_out_date ? `Until ${item.check_out_date}` : "" : item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : ""}</small></td><td><span className={`manager-status manager-status-${item.status.toLowerCase()}`}>{item.status}</span></td><td className="manager-reservations-actions"><button onClick={() => show(item)}>Details</button>{manager && item.status === "Pending" && <button onClick={() => status(item, "Confirmed")}>Confirm</button>}{manager && item.status === "Confirmed" && <button onClick={() => status(item, "Completed")}>Complete</button>}</td></tr>; })}</tbody></table>{!items.length && <p className="empty">No reservations found.</p>}</div><form hidden={!canCreateReservations(user)} className="form-panel reservation-form" onSubmit={submit}><h2>New reservation</h2><label>Type<select value={type} onChange={e => setType(e.target.value)}><option>HOTEL</option><option>RESTAURANT</option></select></label>{type === "HOTEL" ? <label>Room<select required value={form.room_id ?? ""} onChange={e => setForm({ ...form, room_id: e.target.value })}><option value="">Select room</option>{rooms.map(room => <option key={room.room_id} value={room.room_id}>{room.room_number} ({room.status})</option>)}</select></label> : <label>Table<select required value={form.table_id ?? ""} onChange={e => setForm({ ...form, table_id: e.target.value })}><option value="">Select table</option>{tables.map(table => <option key={table.table_id} value={table.table_id}>{table.table_number} ({table.status})</option>)}</select></label>}{type === "HOTEL" ? <><label>Check in<input required type="date" value={form.check_in_date ?? ""} onChange={e => setForm({ ...form, check_in_date: e.target.value })} /></label><label>Check out<input required type="date" value={form.check_out_date ?? ""} onChange={e => setForm({ ...form, check_out_date: e.target.value })} /></label></> : <><label>Date<input required type="date" value={form.reservation_date ?? ""} onChange={e => setForm({ ...form, reservation_date: e.target.value })} /></label><label>Start<input required type="time" value={form.start_time ?? ""} onChange={e => setForm({ ...form, start_time: e.target.value })} /></label><label>End<input required type="time" value={form.end_time ?? ""} onChange={e => setForm({ ...form, end_time: e.target.value })} /></label></>}<label>Special request<textarea value={form.special_request ?? ""} onChange={e => setForm({ ...form, special_request: e.target.value })} /></label><button type="submit">Create reservation</button></form>{selected && <div className="detail"><h2>Reservation {selected.reservation_id}</h2><p>Status: {selected.status}</p><h3>Status history</h3>{history.length ? <ul>{history.map(entry => <li key={entry.history_id}>{entry.status} at {entry.changed_at}: {entry.remarks ?? ""}</li>)}</ul> : <p>No history.</p>}<button onClick={() => setSelected(null)}>Close</button></div>}</Page>;
}

function CombinedBookings() {
    const { user } = useAuth(); const manager = isManager(user); const [items, setItems] = useState<CombinedBooking[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [tables, setTables] = useState<RestaurantTable[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [form, setForm] = useState({ room_id: "", check_in_date: "", check_out_date: "", table_id: "", reservation_date: "", start_time: "", end_time: "" });
    const load = () => apiGet<CombinedBooking[]>("/combined-bookings").then(setItems).catch(e => setError(e.message));
    useEffect(() => { load(); apiGet<Room[]>("/rooms").then(setRooms).catch(() => undefined); apiGet<RestaurantTable[]>("/tables").then(setTables).catch(() => undefined); }, []);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); try { await apiPost("/combined-bookings/hotel-restaurant", buildCombinedBookingPayload({ roomId: Number(form.room_id), checkIn: form.check_in_date, checkOut: form.check_out_date, tableId: Number(form.table_id), date: form.reservation_date, startTime: form.start_time, endTime: form.end_time })); setMessage("Combined booking created"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Combined booking failed"); } };
    const status = async (item: CombinedBooking, next: string) => { try { await apiPatch(`/combined-bookings/${item.combined_booking_id}/status`, { status: next }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Status update failed"); } };
    return <Page title="Combined bookings" error={error}>{message && <div className="alert success">{message}</div>}<div className="manager-reservations-table-wrap"><table className="manager-reservations-table"><thead><tr><th>Reservation</th><th>Guest</th><th>Property / Booking</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item => { const hotelReservation = item.reservation?.find(reservation => reservation.room_id != null); const diningReservation = item.reservation?.find(reservation => reservation.table_id != null); const room = rooms.find(candidate => candidate.room_id === hotelReservation?.room_id); const table = tables.find(candidate => candidate.table_id === diningReservation?.table_id); const count = item.reservation?.length ?? 0; return <tr key={item.combined_booking_id}><td><strong>#{item.combined_booking_id}</strong><small>{count} {count === 1 ? "reservation" : "reservations"}</small>{item.created_at && <small>Created {item.created_at.slice(0, 10)}</small>}</td><td>{item.user ? `${item.user.first_name} ${item.user.last_name}` : "—"}</td><td><strong>{room?.hotel?.name ?? "—"}{table?.restaurant?.name ? ` + ${table.restaurant.name}` : ""}</strong><small>{room ? `Room ${room.room_number}` : "—"}{table ? ` · Table ${table.table_number}` : ""}</small></td><td>{hotelReservation?.check_in_date ?? diningReservation?.reservation_date ?? "—"}{hotelReservation?.check_out_date && <small>Until {hotelReservation.check_out_date}</small>}{hotelReservation && diningReservation?.reservation_date && <small>{diningReservation.reservation_date} {diningReservation.start_time ?? ""}{diningReservation.end_time ? `–${diningReservation.end_time}` : ""}</small>}</td><td><span className={`manager-status manager-status-${item.status.toLowerCase()}`}>{item.status}</span></td><td className="manager-reservations-actions">{manager && item.status === "Pending" && <button onClick={() => status(item, "Confirmed")}>Confirm</button>}{manager && item.status === "Confirmed" && <button onClick={() => status(item, "Completed")}>Complete</button>}</td></tr>; })}</tbody></table>{!items.length && <p className="empty">No combined bookings found.</p>}</div><form hidden={!canCreateReservations(user)} className="form-panel reservation-form" onSubmit={submit}><h2>New hotel + restaurant booking</h2><label>Room<select required value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })}><option value="">Select room</option>{rooms.map(room => <option key={room.room_id} value={room.room_id}>{room.room_number}</option>)}</select></label><label>Check in<input required type="date" value={form.check_in_date} onChange={e => setForm({ ...form, check_in_date: e.target.value })} /></label><label>Check out<input required type="date" value={form.check_out_date} onChange={e => setForm({ ...form, check_out_date: e.target.value })} /></label><label>Table<select required value={form.table_id} onChange={e => setForm({ ...form, table_id: e.target.value })}><option value="">Select table</option>{tables.map(table => <option key={table.table_id} value={table.table_id}>{table.table_number}</option>)}</select></label><label>Date<input required type="date" value={form.reservation_date} onChange={e => setForm({ ...form, reservation_date: e.target.value })} /></label><label>Start<input required type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></label><label>End<input required type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></label><button type="submit">Create combined booking</button></form></Page>;
}

function Reports() {
    const [report, setReport] = useState("reservations"); const [filters, setFilters] = useState({ date_from: "", date_to: "", status: "", type: "", hotel_id: "", restaurant_id: "", room_id: "", table_id: "" });
    const [data, setData] = useState<Record<string, unknown> | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
    const load = async () => { setLoading(true); setError(""); const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)); try { setData(await apiGet<Record<string, unknown>>(`/reports/${report}${query.toString() ? `?${query}` : ""}`)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load report"); } finally { setLoading(false); } };
    useEffect(() => { void load(); }, []);
    const update = (key: keyof typeof filters, value: string) => setFilters({ ...filters, [key]: value });
    const hasNoRows = Boolean(data && ["reservations", "revenue", "tables"].includes(report) && Array.isArray(data.reservations) && data.reservations.length === 0);
    return <Page title="Reports" error={error} loading={loading}><form className="toolbar" onSubmit={event => { event.preventDefault(); void load(); }}><label>Report<select value={report} onChange={e => setReport(e.target.value)}><option value="reservations">Reservation summary/status</option><option value="revenue">Revenue</option><option value="occupancy">Room occupancy</option><option value="tables">Table reservations</option></select></label><label>From<input type="date" value={filters.date_from} onChange={e => update("date_from", e.target.value)} /></label><label>To<input type="date" value={filters.date_to} onChange={e => update("date_to", e.target.value)} /></label><label>Status<select value={filters.status} onChange={e => update("status", e.target.value)}><option value="">All statuses</option>{["Pending", "Confirmed", "Rejected", "Completed", "Cancelled"].map(status => <option key={status}>{status}</option>)}</select></label><label>Type<select value={filters.type} onChange={e => update("type", e.target.value)}><option value="">All types</option><option>HOTEL</option><option>RESTAURANT</option></select></label><label>Hotel ID<input inputMode="numeric" value={filters.hotel_id} onChange={e => update("hotel_id", e.target.value)} /></label><label>Restaurant ID<input inputMode="numeric" value={filters.restaurant_id} onChange={e => update("restaurant_id", e.target.value)} /></label><label>Room ID<input inputMode="numeric" value={filters.room_id} onChange={e => update("room_id", e.target.value)} /></label><label>Table ID<input inputMode="numeric" value={filters.table_id} onChange={e => update("table_id", e.target.value)} /></label><button type="submit">Load report</button></form>{hasNoRows ? <p className="empty">No matching records.</p> : data ? <div className="report-block"><h2>{report}</h2><pre>{JSON.stringify(data, null, 2)}</pre></div> : <p className="empty">No report data.</p>}</Page>;
}

function Profile() { const { user, updateProfile } = useAuth(); const manager = isManager(user); const [form, setForm] = useState({ first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", phone: user?.phone ?? "" }); const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" }); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { await updateProfile(form); setMessage("Profile updated"); } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); } }; const changePassword = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); if (passwordErrors(passwordForm.next).length) { setError(`Password does not meet the requirements: ${passwordErrors(passwordForm.next).join(", ")}`); return; } if (passwordForm.next !== passwordForm.confirm) { setError("Password confirmation does not match"); return; } try { const result = await apiPost<{ message: string }>("/auth/change-password", { current_password: passwordForm.current, new_password: passwordForm.next }); setMessage(result.message); setPasswordForm({ current: "", next: "", confirm: "" }); } catch (e) { setError(e instanceof Error ? e.message : "Password change failed"); } }; return <Page title="Profile" error={error}>{message && <div className="alert success">{message}</div>}{manager && <section className="manager-profile-overview"><div className="manager-profile-avatar">{user?.first_name?.trim().charAt(0).toUpperCase() || "—"}</div><div className="manager-profile-identity"><h2>{`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()}</h2><span className="manager-profile-role">{role(user)}</span><p>{user?.email}</p><small>{user?.phone || "Phone not provided"}</small></div></section>}<form className={manager ? "form-panel manager-profile-form" : "form-panel"} onSubmit={submit}><h2>Profile details</h2><label>Email<input value={user?.email ?? ""} disabled /></label><label>First name<input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label>Last name<input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><button type="submit">Save profile</button></form><form className={manager ? "form-panel password-form manager-profile-password-form" : "form-panel password-form"} onSubmit={changePassword}><h2>Change Password</h2><label>Current password<input type="password" required value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} /></label><label>New password<input type="password" required value={passwordForm.next} onChange={e => setPasswordForm({ ...passwordForm, next: e.target.value })} /></label><PasswordRequirements password={passwordForm.next} /><label>Confirm new password<input type="password" required value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} /></label><button type="submit">Change Password</button></form></Page>; }

export function App() {
    return <Routes><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage registerMode />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Protected><AppLayout><Routes><Route path="/" element={<LandingRedirect />} /><Route path="/home" element={<Home />} /><Route path="/dashboard" element={<RoleRoute roles={["Staff", "Admin"]}><Dashboard /></RoleRoute>} /><Route path="/hotels" element={<HotelCatalogRoute />} /><Route path="/hotels/:hotelId" element={<HotelDetails />} /><Route path="/restaurants" element={<RestaurantCatalogRoute />} /><Route path="/restaurants/:restaurantId" element={<RestaurantDetails />} /><Route path="/rooms" element={<RoleRoute roles={["Staff", "Admin"]}><ResourcePage kind="rooms" /></RoleRoute>} /><Route path="/tables" element={<RoleRoute roles={["Staff", "Admin"]}><ResourcePage kind="tables" /></RoleRoute>} /><Route path="/reservations" element={<ReservationsRoute />} /><Route path="/combined-bookings" element={<CombinedBookingsRoute />} /><Route path="/reports" element={<RoleRoute roles={["Staff", "Admin"]}><Reports /></RoleRoute>} /><Route path="/users" element={<RoleRoute roles={["Admin"]}><Users /></RoleRoute>} /><Route path="/notifications" element={<Notifications />} /><Route path="/profile" element={<Profile />} /><Route path="*" element={<Navigate to="/home" replace />} /></Routes></AppLayout></Protected>} /></Routes>;
}
