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
const userName = (user: User | null) => [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || "Staff Member";
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
    const staffName = userName(user);
    return <div className="manager-app customer-app">
        <header className="customer-navbar">
            <Link to="/dashboard" className="customer-logo">
                <span className="customer-logo-icon">L</span>
                <span>StayEase</span>
            </Link>
            <nav className="customer-nav-links">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/properties">Hotels &amp; Restaurants</NavLink>
                <NavLink to="/reservations">Reservations</NavLink>
                <NavLink to="/manage">Manage</NavLink>
                {isAdmin(user) && <>
                    <NavLink to="/hotels">Hotels</NavLink>
                    <NavLink to="/restaurants">Restaurants</NavLink>
                    <NavLink to="/rooms">Rooms</NavLink>
                    <NavLink to="/tables">Tables</NavLink>
                    <NavLink to="/reports">Reports</NavLink>
                    <NavLink to="/users">Users</NavLink>
                </>}
            </nav>
            <div className="customer-nav-actions">
                <NavLink to="/profile" className="customer-profile-link">
                    {staffName}<span className="staff-role-label">{role(user)}</span>
                </NavLink>
                <NavLink to="/notifications" className="customer-profile-link">Notifications</NavLink>
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
    const { user } = useAuth();
    const [data, setData] = useState<Record<string, number> | null>(null); const [error, setError] = useState("");
    useEffect(() => { apiGet<Record<string, number>>("/dashboard").then(setData).catch(e => setError(e.message)); }, []);
    if (!data) return <Page title="Dashboard" error={error} loading={!error}>{null}</Page>;
    const occupiedRooms = Math.max(0, data.rooms - data.availableRooms);
    const occupancy = data.rooms > 0 ? Math.round((occupiedRooms / data.rooms) * 100) : 0;
    const statusCounts = [
        { label: "Confirmed", count: data.confirmedReservations, className: "confirmed" },
        { label: "Pending", count: data.pendingReservations, className: "pending" },
        { label: "Cancelled", count: data.cancelledReservations, className: "cancelled" }
    ];
    const statusTotal = statusCounts.reduce((total, item) => total + item.count, 0);
    return <section className="listing-section staff-dashboard-page">
        <div className="staff-dashboard-heading">
            <div>
                <p className="eyebrow">STAFF WORKSPACE</p>
                <h1>Dashboard</h1>
                <p className="staff-manage-description">Welcome, {userName(user)}. Here's what's happening across your properties.</p>
            </div>
            <span className="staff-dashboard-badge">{role(user)}</span>
        </div>
        <div className="staff-dashboard-stats">
            <article className="staff-dashboard-stat">
                <p>ROOM OCCUPANCY</p>
                <span className="staff-stat-icon">📊</span>
                <strong className="orange-stat">{occupancy}%</strong>
                <small>{occupiedRooms}/{data.rooms} rooms occupied</small>
            </article>
        </div>
        <section className="staff-dashboard-panel">
            <h2>Reservation Status Breakdown</h2>
            <div className="staff-status-breakdown">
                {statusCounts.map(item => {
                    const percentage = statusTotal ? Math.round((item.count / statusTotal) * 100) : 0;
                    return <div className="staff-status-item" key={item.label}>
                        <div className="staff-status-label"><span>{item.label}</span><strong>{item.count}</strong></div>
                        <div className="staff-status-track"><span className={item.className} style={{ width: `${percentage}%` }} /></div>
                        <small>{percentage}%</small>
                    </div>;
                })}
            </div>
        </section>
    </section>;
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
    if (manager) return <section className="listing-section">
        <h1>Notifications</h1>
        {error && <div className="alert error">{error}</div>}
        {loading ? <p>Loading...</p> : items.length ? <div className="reservation-list">{items.map(item => <article className="reservation-card" key={String(item.notification_id)}>
            <div className="reservation-details">
                <div className="reservation-card-heading"><div><h2>{String(item.title)}</h2><p>{String(item.message)}</p></div><span className={`reservation-status ${Boolean(item.is_read) ? "confirmed" : ""}`}>{Boolean(item.is_read) ? "Read" : "Unread"}</span></div>
                <div className="reservation-meta"><div><span>DATE</span><strong>{item.created_at ? new Date(String(item.created_at)).toLocaleString() : "—"}</strong></div></div>
                {!Boolean(item.is_read) && <div className="reservation-card-footer"><span /><button type="button" className="combined-stay-button" onClick={() => markRead(Number(item.notification_id))}>Mark Read</button></div>}
            </div>
        </article>)}</div> : <p>Your notifications will appear here.</p>}
    </section>;
    return <Page title="Notifications" error={error} loading={loading}>{items.length ? <div className="detail"><ul>{items.map(item => <li key={String(item.notification_id)}><strong>{String(item.title)}</strong>: {String(item.message)} <small>{item.created_at ? new Date(String(item.created_at)).toLocaleString() : ""}</small> {Boolean(item.is_read) ? <span>Read</span> : <button onClick={() => markRead(Number(item.notification_id))}>Mark read</button>}</li>)}</ul></div> : <p className="empty">No notifications.</p>}</Page>;
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

function Reservations({ manageView = false }: { manageView?: boolean } = {}) {
    const { user } = useAuth(); const navigate = useNavigate(); const manager = isManager(user); const [items, setItems] = useState<Reservation[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [tables, setTables] = useState<RestaurantTable[]>([]); const [selected, setSelected] = useState<Reservation | null>(null); const [history, setHistory] = useState<ReservationHistory[]>([]); const [type, setType] = useState("HOTEL"); const [statusFilter, setStatusFilter] = useState(""); const [category, setCategory] = useState<"Hotels" | "Dining">("Hotels"); const [manageType, setManageType] = useState<"Hotel" | "Restaurant">("Hotel"); const [search, setSearch] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");
    const [form, setForm] = useState<Record<string, string>>({});
    const load = () => apiGet<Reservation[]>(`/reservations${statusFilter ? `?status=${statusFilter}` : ""}`).then(setItems).catch(e => setError(e.message));
    useEffect(() => { load(); apiGet<Room[]>("/rooms").then(setRooms).catch(() => undefined); apiGet<RestaurantTable[]>("/tables").then(setTables).catch(() => undefined); }, [statusFilter]);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); try { await apiPost("/reservations", { ...form, reservation_type: type, room_id: type === "HOTEL" ? Number(form.room_id) : null, table_id: type === "RESTAURANT" ? Number(form.table_id) : null }); setForm({}); setMessage("Reservation created"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Reservation failed"); } };
    const show = async (item: Reservation) => { setSelected(item); try { setHistory(await apiGet<ReservationHistory[]>(`/reservations/${item.reservation_id}/history`)); } catch (e) { setError(e instanceof Error ? e.message : "History failed"); } };
    const status = async (item: Reservation, next: string) => { try { await apiPatch(`/reservations/${item.reservation_id}/status`, { status: next }); setMessage("Status updated"); load(); } catch (e) { setError(e instanceof Error ? e.message : "Status update failed"); } };
    const hotelCount = items.filter(item => item.reservation_type === "HOTEL").length;
    const diningCount = items.filter(item => item.reservation_type === "RESTAURANT").length;
    const upcomingCount = items.filter(item => item.status === "Pending" || item.status === "Confirmed").length;
    const displayed = items.filter(item => item.reservation_type === (category === "Hotels" ? "HOTEL" : "RESTAURANT"));
    const managedItems = items.filter(item => item.reservation_type === (manageType === "Hotel" ? "HOTEL" : "RESTAURANT") && `${item.reservation_id} ${item.user?.first_name ?? ""} ${item.user?.last_name ?? ""} ${item.room?.hotel?.name ?? item.restaurant_table?.restaurant?.name ?? ""} ${item.room?.room_number ?? item.restaurant_table?.table_number ?? ""}`.toLowerCase().includes(search.toLowerCase()));
    if (manageView) return <section className="listing-section staff-manage-page">
        <p className="eyebrow">STAFF WORKSPACE</p>
        <h1>Manage Reservations</h1>
        <p className="staff-manage-description">View booking details and manage hotel, table, and combined reservations.</p>
        {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
        <div className="staff-manage-tabs" role="tablist">
            {(["Hotel", "Restaurant"] as const).map(tab => <button type="button" role="tab" aria-selected={manageType === tab} className={`staff-manage-tab ${manageType === tab ? "active" : ""}`} key={tab} onClick={() => { setManageType(tab); setSelected(null); }}>{tab === "Hotel" ? "Hotels" : "Dining"}<span>{tab === "Hotel" ? hotelCount : diningCount}</span></button>)}
            <Link to="/combined-bookings" className="staff-manage-tab">Combined Stay</Link>
        </div>
        <div className="staff-manage-toolbar">
            <input type="search" placeholder="Search by reservation ID, guest, or property..." aria-label="Search reservations" value={search} onChange={event => setSearch(event.target.value)} />
            <span>{managedItems.length} reservations</span>
        </div>
        <div className="staff-table-wrap">
            <table className="staff-reservations-table">
                <thead><tr><th>Reservation</th><th>Guest</th><th>Property / Booking</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{managedItems.map(item => {
                    const room = rooms.find(candidate => candidate.room_id === item.room_id) ?? item.room;
                    const table = tables.find(candidate => candidate.table_id === item.table_id) ?? item.restaurant_table;
                    const propertyName = room?.hotel?.name ?? table?.restaurant?.name ?? "—";
                    const bookingName = room ? `${room.room_type} · Room ${room.room_number}` : table ? `Table ${table.table_number}` : "—";
                    const startDate = item.reservation_type === "HOTEL" ? item.check_in_date : item.reservation_date;
                    const endDate = item.reservation_type === "HOTEL" ? item.check_out_date : null;
                    return <tr key={item.reservation_id}>
                        <td><strong>#{item.reservation_id}</strong><small>{item.reservation_type}</small></td>
                        <td>{item.user ? `${item.user.first_name} ${item.user.last_name}` : "—"}</td>
                        <td><strong>{propertyName}</strong><small>{bookingName}{room?.price_per_night != null ? ` · ₱${Number(room.price_per_night).toLocaleString("en-PH")}/night` : ""}</small></td>
                        <td>{startDate?.slice(0, 10) ?? "—"}{endDate && <small>Until {endDate.slice(0, 10)}</small>}{item.reservation_type === "RESTAURANT" && item.start_time && item.end_time && <small>{item.start_time}–{item.end_time}</small>}</td>
                        <td><select aria-label={`Status for reservation ${item.reservation_id}`} className={`staff-status-select ${item.status.toLowerCase()}`} value={item.status} onChange={event => status(item, event.target.value)}>{["Pending", "Confirmed", "Rejected", "Cancelled", "Completed"].map(value => <option key={value}>{value}</option>)}</select></td>
                        <td><div className="staff-table-actions"><button type="button" onClick={() => show(item)}>View</button></div></td>
                    </tr>;
                })}{managedItems.length === 0 && <tr><td colSpan={6} className="staff-empty-state">No reservations match your search.</td></tr>}</tbody>
            </table>
        </div>
        {selected && <section className="staff-manage-panel"><h2>Reservation #{selected.reservation_id}</h2><p><strong>Type:</strong> {selected.reservation_type}</p><p><strong>Guest:</strong> {selected.user ? `${selected.user.first_name} ${selected.user.last_name}` : "—"}</p><p><strong>Property:</strong> {selected.room?.hotel?.name ?? selected.restaurant_table?.restaurant?.name ?? "—"}</p><p><strong>Room / Booking:</strong> {selected.room ? `${selected.room.room_type} · Room ${selected.room.room_number}` : selected.restaurant_table ? `Table ${selected.restaurant_table.table_number}` : "—"}</p><p><strong>Date:</strong> {selected.check_in_date ?? selected.reservation_date ?? "—"}</p>{selected.check_out_date && <p><strong>Check-out:</strong> {selected.check_out_date}</p>}{selected.start_time && <p><strong>Time:</strong> {selected.start_time}{selected.end_time ? `–${selected.end_time}` : ""}</p>}<p><strong>Status:</strong> {selected.status}</p><h3>Status history</h3>{history.length ? <ul>{history.map(entry => <li key={entry.history_id}>{entry.status} at {entry.changed_at}: {entry.remarks ?? ""}</li>)}</ul> : <p>No history.</p>}<button type="button" className="staff-secondary-button" onClick={() => setSelected(null)}>Close Details</button></section>}
    </section>;
    return <>
        <section className="reservations-page">
            <div className="reservations-heading">
                <div><h1>Reservations</h1><p>Manage and monitor all reservations here.</p></div>
                <Link to="/combined-bookings" className="combined-stay-button">+ Plan a Combined Stay</Link>
            </div>
            {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
            <div className="reservation-stats">
                <div className="stat-card"><span>Hotel Bookings</span><strong>{hotelCount}</strong></div>
                <div className="stat-card"><span>Dining Reservations</span><strong>{diningCount}</strong></div>
                <div className="stat-card"><span>Upcoming</span><strong className="upcoming-number">{upcomingCount}</strong></div>
            </div>
            <div className="reservation-toolbar">
                <div className="reservation-tabs">
                    {(["Hotels", "Dining"] as const).map(item => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
                    <button type="button" onClick={() => navigate("/combined-bookings")}>Combined</button>
                </div>
                <select aria-label="Filter by reservation status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                    <option value="">All Statuses</option>{["Pending", "Confirmed", "Rejected", "Cancelled", "Completed"].map(value => <option key={value}>{value}</option>)}
                </select>
            </div>
            <div className="reservation-list">
                {displayed.length ? displayed.map(item => {
                    const room = rooms.find(candidate => candidate.room_id === item.room_id) ?? item.room;
                    const table = tables.find(candidate => candidate.table_id === item.table_id) ?? item.restaurant_table;
                    const hotel = room?.hotel;
                    const restaurant = table?.restaurant;
                    const isHotel = item.reservation_type === "HOTEL";
                    const start = isHotel ? item.check_in_date : item.reservation_date;
                    const end = isHotel ? item.check_out_date : item.end_time;
                    const nights = isHotel && item.check_in_date && item.check_out_date ? Math.ceil((Date.parse(item.check_out_date) - Date.parse(item.check_in_date)) / 86400000) : null;
                    const nightlyRate = isHotel && room?.price_per_night != null ? `₱${Number(room.price_per_night).toLocaleString("en-PH")} / night` : null;
                    const guestName = item.user ? `${item.user.first_name} ${item.user.last_name}` : "—";
                    return <article className="reservation-card" key={item.reservation_id}>
                        <div className="reservation-image-placeholder">{isHotel ? "Stay" : "Dining"}</div>
                        <div className="reservation-details">
                            <div className="reservation-card-heading">
                                <div><h2>{hotel?.name ?? restaurant?.name ?? (isHotel ? `Room ${room?.room_number ?? "—"}` : `Table ${table?.table_number ?? "—"}`)}</h2><p>Guest: {guestName}</p><p>{isHotel ? `${room?.room_type ?? ""}${room ? ` · Room ${room.room_number}` : ""}` : table ? `Table ${table.table_number}` : ""}{(hotel?.address ?? restaurant?.address) ? ` · ${hotel?.address ?? restaurant?.address}` : ""}</p></div>
                                <span className={`reservation-status ${item.status.toLowerCase()}`}>{item.status}</span>
                            </div>
                            <div className="reservation-meta">
                                <div><span>{isHotel ? "CHECK-IN" : "DATE"}</span><strong>{start?.slice(0, 10) ?? "—"}</strong></div>
                                <div><span>{isHotel ? "CHECK-OUT" : "TIME"}</span><strong>{isHotel ? end?.slice(0, 10) ?? "—" : item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : "—"}</strong></div>
                                <div><span>{isHotel ? "DURATION" : "TABLE"}</span><strong>{isHotel ? nights === null ? "—" : `${nights} nights` : table?.table_number ?? "—"}</strong></div>
                            </div>
                            <div className="reservation-card-footer">
                                {nightlyRate ? <strong className="reservation-price">{nightlyRate}</strong> : <span />}
                                <div>
                                    <button type="button" className="combined-stay-button" onClick={() => show(item)}>Details</button>
                                    {manager && item.status === "Pending" && <button type="button" className="combined-stay-button" onClick={() => status(item, "Confirmed")}>Confirm</button>}
                                    {manager && item.status === "Confirmed" && <button type="button" className="combined-stay-button" onClick={() => status(item, "Completed")}>Complete</button>}
                                    {manager && item.status !== "Cancelled" && <button type="button" className="cancel-reservation-button" onClick={() => status(item, "Cancelled")}>Cancel</button>}
                                </div>
                            </div>
                        </div>
                    </article>;
                }) : <div className="reservations-empty-state"><h2>No reservations found</h2><p>Try another category or status.</p></div>}
            </div>
        </section>
        <form hidden={!canCreateReservations(user)} className="form-panel reservation-form" onSubmit={submit}><h2>New reservation</h2><label>Type<select value={type} onChange={e => setType(e.target.value)}><option>HOTEL</option><option>RESTAURANT</option></select></label>{type === "HOTEL" ? <label>Room<select required value={form.room_id ?? ""} onChange={e => setForm({ ...form, room_id: e.target.value })}><option value="">Select room</option>{rooms.map(room => <option key={room.room_id} value={room.room_id}>{room.room_number} ({room.status})</option>)}</select></label> : <label>Table<select required value={form.table_id ?? ""} onChange={e => setForm({ ...form, table_id: e.target.value })}><option value="">Select table</option>{tables.map(table => <option key={table.table_id} value={table.table_id}>{table.table_number} ({table.status})</option>)}</select></label>}{type === "HOTEL" ? <><label>Check in<input required type="date" value={form.check_in_date ?? ""} onChange={e => setForm({ ...form, check_in_date: e.target.value })} /></label><label>Check out<input required type="date" value={form.check_out_date ?? ""} onChange={e => setForm({ ...form, check_out_date: e.target.value })} /></label></> : <><label>Date<input required type="date" value={form.reservation_date ?? ""} onChange={e => setForm({ ...form, reservation_date: e.target.value })} /></label><label>Start<input required type="time" value={form.start_time ?? ""} onChange={e => setForm({ ...form, start_time: e.target.value })} /></label><label>End<input required type="time" value={form.end_time ?? ""} onChange={e => setForm({ ...form, end_time: e.target.value })} /></label></>}<label>Special request<textarea value={form.special_request ?? ""} onChange={e => setForm({ ...form, special_request: e.target.value })} /></label><button type="submit">Create reservation</button></form>
        {selected && <div className="detail"><h2>Reservation {selected.reservation_id}</h2><p>Status: {selected.status}</p><h3>Status history</h3>{history.length ? <ul>{history.map(entry => <li key={entry.history_id}>{entry.status} at {entry.changed_at}: {entry.remarks ?? ""}</li>)}</ul> : <p>No history.</p>}<button onClick={() => setSelected(null)}>Close</button></div>}
    </>;
}

function CombinedBookings() {
    const { user } = useAuth(); const manager = isManager(user); const [items, setItems] = useState<CombinedBooking[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [tables, setTables] = useState<RestaurantTable[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [step, setStep] = useState(1); const [selectedHotelId, setSelectedHotelId] = useState(""); const [selectedRestaurantId, setSelectedRestaurantId] = useState(""); const [form, setForm] = useState({ room_id: "", check_in_date: "", check_out_date: "", table_id: "", reservation_date: "", start_time: "", end_time: "" });
    const load = () => apiGet<CombinedBooking[]>("/combined-bookings").then(setItems).catch(e => setError(e.message));
    useEffect(() => { load(); apiGet<Room[]>("/rooms").then(data => { setRooms(data); if (data[0]) setSelectedHotelId(String(data[0].hotel_id)); }).catch(() => undefined); apiGet<RestaurantTable[]>("/tables").then(data => { setTables(data); if (data[0]) setSelectedRestaurantId(String(data[0].restaurant_id)); }).catch(() => undefined); }, []);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); try { await apiPost("/combined-bookings/hotel-restaurant", buildCombinedBookingPayload({ roomId: Number(form.room_id), checkIn: form.check_in_date, checkOut: form.check_out_date, tableId: Number(form.table_id), date: form.reservation_date, startTime: form.start_time, endTime: form.end_time })); setMessage("Combined booking created"); load(); setStep(1); } catch (e) { setError(e instanceof Error ? e.message : "Combined booking failed"); } };
    const status = async (item: CombinedBooking, next: string) => { try { await apiPatch(`/combined-bookings/${item.combined_booking_id}/status`, { status: next }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Status update failed"); } };
    const hotelIds = Array.from(new Set(rooms.map(room => room.hotel_id)));
    const restaurantIds = Array.from(new Set(tables.map(table => table.restaurant_id)));
    const hotelRooms = rooms.filter(room => String(room.hotel_id) === selectedHotelId);
    const restaurantTables = tables.filter(table => String(table.restaurant_id) === selectedRestaurantId);
    const selectedRoom = rooms.find(room => String(room.room_id) === form.room_id);
    const selectedTable = tables.find(table => String(table.table_id) === form.table_id);
    const selectedHotel = selectedRoom?.hotel;
    const selectedRestaurant = selectedTable?.restaurant;
    const advance = () => {
        setError("");
        if (step === 1 && (!form.room_id || !form.check_in_date || !form.check_out_date)) { setError("Choose a room and enter check-in and check-out dates."); return; }
        if (step === 2 && (!form.table_id || !form.reservation_date || !form.start_time || !form.end_time)) { setError("Choose a table and enter the dining date, start time, and end time."); return; }
        setStep(value => Math.min(3, value + 1));
    };
    return <>
        <section className="combined-wizard">
            <div className="combined-wizard-container">
                <header className="combined-wizard-header">
                    <p className="eyebrow">YOUR COMPLETE GETAWAY</p>
                    <h1>Plan Your Complete Stay</h1>
                    <p>Select a room, then choose a table and dining time.</p>
                </header>
                {message && <p className="alert success" role="status">{message}</p>}{error && <p className="combined-error" role="alert">{error}</p>}
                <div className="combined-steps">{[{ number: 1, label: "Hotel & Room" }, { number: 2, label: "Restaurant" }, { number: 3, label: "Review" }].map(item => <div key={item.number} className={`combined-step ${step === item.number ? "active" : ""} ${step > item.number ? "completed" : ""}`}><span>{step > item.number ? "✓" : item.number}</span><small>{item.label}</small></div>)}</div>
                <form className="combined-wizard-form" onSubmit={submit}>
                    {step === 1 && <>
                        <p className="eyebrow">CHOOSE YOUR HOTEL</p>
                        <div className="combined-hotel-grid">{hotelIds.map(hotelId => {
                            const hotel = rooms.find(room => room.hotel_id === hotelId)?.hotel;
                            return <button type="button" key={hotelId} className={`combined-hotel-card ${selectedHotelId === String(hotelId) ? "selected" : ""}`} onClick={() => { setSelectedHotelId(String(hotelId)); setForm({ ...form, room_id: "" }); }} aria-pressed={selectedHotelId === String(hotelId)}><span className="combined-card-copy"><strong>{hotel?.name ?? `Hotel #${hotelId}`}</strong><small>{hotel?.address ?? ""}</small></span></button>;
                        })}</div>
                        <p className="eyebrow combined-section-label">SELECT A ROOM</p>
                        <div className="combined-room-list">{hotelRooms.map(room => <label key={room.room_id} className={`combined-room-option ${form.room_id === String(room.room_id) ? "selected" : ""}`}><input type="radio" name="room" value={room.room_id} checked={form.room_id === String(room.room_id)} onChange={() => setForm({ ...form, room_id: String(room.room_id) })} /><span className="combined-room-copy"><strong>{room.room_type} · Room {room.room_number}</strong><small>{room.status} · Capacity {room.capacity}</small></span><strong className="combined-room-price">₱{Number(room.price_per_night).toLocaleString("en-PH")}<small>/ night</small></strong></label>)}</div>
                        <div className="combined-fields"><p className="eyebrow">DATES</p><div className="combined-field-grid"><label>Check-in<input type="date" value={form.check_in_date} onChange={event => setForm({ ...form, check_in_date: event.target.value })} required /></label><label>Check-out<input type="date" min={form.check_in_date || undefined} value={form.check_out_date} onChange={event => setForm({ ...form, check_out_date: event.target.value })} required /></label></div></div>
                    </>}
                    {step === 2 && <>
                        <p className="eyebrow">CHOOSE YOUR RESTAURANT</p>
                        <div className="combined-hotel-grid">{restaurantIds.map(restaurantId => {
                            const restaurant = tables.find(table => table.restaurant_id === restaurantId)?.restaurant;
                            return <button type="button" key={restaurantId} className={`combined-hotel-card ${selectedRestaurantId === String(restaurantId) ? "selected" : ""}`} onClick={() => { setSelectedRestaurantId(String(restaurantId)); setForm({ ...form, table_id: "" }); }} aria-pressed={selectedRestaurantId === String(restaurantId)}><span className="combined-card-copy"><strong>{restaurant?.name ?? `Restaurant #${restaurantId}`}</strong><small>{restaurant?.address ?? ""}</small></span></button>;
                        })}</div>
                        <p className="eyebrow combined-section-label">SELECT A TABLE</p>
                        <div className="combined-room-list">{restaurantTables.map(table => <label key={table.table_id} className={`combined-room-option ${form.table_id === String(table.table_id) ? "selected" : ""}`}><input type="radio" name="table" value={table.table_id} checked={form.table_id === String(table.table_id)} onChange={() => setForm({ ...form, table_id: String(table.table_id) })} /><span className="combined-room-copy"><strong>Table {table.table_number}</strong><small>{table.status} · Capacity {table.capacity}</small></span></label>)}</div>
                        <div className="combined-fields"><p className="eyebrow">DINING DETAILS</p><div className="combined-field-grid"><label>Dining date<input type="date" min={form.check_in_date || undefined} max={form.check_out_date || undefined} value={form.reservation_date} onChange={event => setForm({ ...form, reservation_date: event.target.value })} required /></label><label>Preferred time<input type="time" value={form.start_time} onChange={event => setForm({ ...form, start_time: event.target.value })} required /></label><label>End time<input type="time" value={form.end_time} onChange={event => setForm({ ...form, end_time: event.target.value })} required /></label></div></div>
                    </>}
                    {step === 3 && <>
                        <p className="eyebrow">CHECK YOUR SELECTIONS</p><h2 className="combined-review-title">Review Your Complete Stay</h2>
                        <div className="combined-review-card"><h3>Hotel &amp; Room</h3><p>{selectedHotel?.name ?? (selectedRoom ? `Hotel #${selectedRoom.hotel_id}` : "—")}</p><p>{selectedRoom?.room_type} · Room {selectedRoom?.room_number}</p><p>{form.check_in_date} → {form.check_out_date}</p>{selectedRoom && <strong>₱{Number(selectedRoom.price_per_night).toLocaleString("en-PH")}<small> per night</small></strong>}</div>
                        <div className="combined-review-card"><h3>Dining Reservation</h3><p>{selectedRestaurant?.name ?? (selectedTable ? `Restaurant #${selectedTable.restaurant_id}` : "—")}</p><p>Table {selectedTable?.table_number}</p><p>{form.reservation_date} · {form.start_time}–{form.end_time}</p></div>
                    </>}
                    <div className="combined-form-actions">
                        {step > 1 && <button type="button" className="combined-secondary-button" onClick={() => { setError(""); setStep(value => value - 1); }}>Back</button>}
                        {step < 3 ? <button type="button" className="combined-primary-button" onClick={advance}>Continue</button> : <button type="submit" className="combined-primary-button" disabled={!canCreateReservations(user)}>Create Combined Booking</button>}
                    </div>
                </form>
            </div>
        </section>
        {message && <div className="alert success">{message}</div>}
        <section className="listing-section staff-manage-page"><p className="eyebrow">STAFF WORKSPACE</p><h1>Combined Bookings</h1><div className="staff-table-wrap"><table className="staff-reservations-table"><thead><tr><th>Reservation</th><th>Guest</th><th>Property / Booking</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item => {
            const hotelReservation = item.reservation?.find(reservation => reservation.room_id != null);
            const diningReservation = item.reservation?.find(reservation => reservation.table_id != null);
            const room = rooms.find(candidate => candidate.room_id === hotelReservation?.room_id) ?? hotelReservation?.room;
            const table = tables.find(candidate => candidate.table_id === diningReservation?.table_id) ?? diningReservation?.restaurant_table;
            const count = item.reservation?.length ?? 0;
            return <tr key={item.combined_booking_id}><td><strong>#{item.combined_booking_id}</strong><small>{count} {count === 1 ? "reservation" : "reservations"}</small>{item.created_at && <small>Created {item.created_at.slice(0, 10)}</small>}</td><td>{item.user ? `${item.user.first_name} ${item.user.last_name}` : "—"}</td><td><strong>{room?.hotel?.name ?? (room ? `Hotel #${room.hotel_id}` : "—")}{table?.restaurant?.name ? ` + ${table.restaurant.name}` : ""}</strong><small>{room ? `Room ${room.room_number}` : "—"}{table ? ` · Table ${table.table_number}` : ""}</small></td><td>{hotelReservation?.check_in_date ?? diningReservation?.reservation_date ?? "—"}{hotelReservation?.check_out_date && <small>Until {hotelReservation.check_out_date.slice(0, 10)}</small>}{hotelReservation && diningReservation?.reservation_date && <small>{diningReservation.reservation_date.slice(0, 10)} {diningReservation.start_time ?? ""}{diningReservation.end_time ? `–${diningReservation.end_time}` : ""}</small>}</td><td><span className={`reservation-status ${item.status.toLowerCase()}`}>{item.status}</span></td><td><div className="staff-table-actions">{manager && item.status === "Pending" && <button type="button" onClick={() => status(item, "Confirmed")}>Confirm</button>}{manager && item.status === "Confirmed" && <button type="button" onClick={() => status(item, "Completed")}>Complete</button>}</div></td></tr>;
        })}{items.length === 0 && <tr><td colSpan={6} className="staff-empty-state">No combined bookings found.</td></tr>}</tbody></table></div></section>
    </>;
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

function Profile() {
    const { user, updateProfile } = useAuth(); const manager = isManager(user);
    const [form, setForm] = useState({ first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", phone: user?.phone ?? "" });
    const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
    const [message, setMessage] = useState(""); const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"info" | "password">("info"); const [editingProfile, setEditingProfile] = useState(false);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { await updateProfile(form); setMessage("Profile updated"); setEditingProfile(false); } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); } };
    const changePassword = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); if (passwordErrors(passwordForm.next).length) { setError(`Password does not meet the requirements: ${passwordErrors(passwordForm.next).join(", ")}`); return; } if (passwordForm.next !== passwordForm.confirm) { setError("Password confirmation does not match"); return; } try { const result = await apiPost<{ message: string }>("/auth/change-password", { current_password: passwordForm.current, new_password: passwordForm.next }); setMessage(result.message); setPasswordForm({ current: "", next: "", confirm: "" }); } catch (e) { setError(e instanceof Error ? e.message : "Password change failed"); } };
    if (manager) return <main className="customer-profile-page">
        <div className="customer-profile-container">
            <section className="profile-overview-card">
                <div className="profile-avatar">{user?.first_name?.trim().charAt(0).toUpperCase() || "—"}</div>
                <div className="profile-overview-info">
                    <div className="profile-name-line"><h1>{`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()}</h1><span className="profile-role-badge">{role(user)}</span></div>
                    <p className="profile-email">{user?.email}</p>
                </div>
            </section>
            {error && <p className="profile-notice" role="alert">{error}</p>}{message && <p className="profile-notice" role="status">{message}</p>}
            <nav className="profile-tabs" aria-label="Profile sections">
                <button type="button" className={activeTab === "info" ? "active" : ""} onClick={() => { setActiveTab("info"); setMessage(""); }}>Profile Info</button>
                <button type="button" className={activeTab === "password" ? "active" : ""} onClick={() => { setActiveTab("password"); setMessage(""); }}>Change Password</button>
            </nav>
            {activeTab === "info" && <section className="profile-content-card">
                <div className="profile-section-heading"><h2>Profile Information</h2><button type="button" className="profile-outline-button" onClick={() => { setEditingProfile(!editingProfile); setMessage(""); }}>{editingProfile ? "Cancel" : "Edit Profile"}</button></div>
                {editingProfile ? <form className="profile-edit-form" onSubmit={submit}>
                    <label>First Name<input value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} required /></label>
                    <label>Last Name<input value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} required /></label>
                    <label>Email Address<input type="email" value={user?.email ?? ""} disabled /></label>
                    <label>Phone Number<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
                    <button type="submit" className="profile-primary-button">Save Changes</button>
                </form> : <div className="profile-information-grid">
                    <div><span>Full Name</span><p>{`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()}</p></div>
                    <div><span>Email Address</span><p>{user?.email}</p></div>
                    <div><span>Phone Number</span><p>{user?.phone || "Not provided"}</p></div>
                    <div><span>Account Type</span><p className="profile-muted-value">{role(user)}</p></div>
                    <div><span>Account ID</span><p className="profile-muted-value">{user?.user_id}</p></div>
                </div>}
            </section>}
            {activeTab === "password" && <section className="profile-content-card">
                <div className="profile-section-heading"><h2>Change Password</h2></div>
                <form className="profile-edit-form profile-password-form" onSubmit={changePassword}>
                    <label>Current Password<input type="password" autoComplete="current-password" value={passwordForm.current} onChange={event => setPasswordForm({ ...passwordForm, current: event.target.value })} required /></label>
                    <label>New Password<input type="password" autoComplete="new-password" value={passwordForm.next} onChange={event => setPasswordForm({ ...passwordForm, next: event.target.value })} required /></label>
                    <PasswordRequirements password={passwordForm.next} />
                    <label>Confirm New Password<input type="password" autoComplete="new-password" value={passwordForm.confirm} onChange={event => setPasswordForm({ ...passwordForm, confirm: event.target.value })} required /></label>
                    <button type="submit" className="profile-primary-button">Update Password</button>
                </form>
            </section>}
        </div>
    </main>;
    return <Page title="Profile" error={error}>{message && <div className="alert success">{message}</div>}<form className="form-panel" onSubmit={submit}><h2>Profile details</h2><label>Email<input value={user?.email ?? ""} disabled /></label><label>First name<input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label>Last name<input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><button type="submit">Save profile</button></form><form className="form-panel password-form" onSubmit={changePassword}><h2>Change Password</h2><label>Current password<input type="password" required value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} /></label><label>New password<input type="password" required value={passwordForm.next} onChange={e => setPasswordForm({ ...passwordForm, next: e.target.value })} /></label><PasswordRequirements password={passwordForm.next} /><label>Confirm new password<input type="password" required value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} /></label><button type="submit">Change Password</button></form></Page>;
}

export function App() {
    return <Routes><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage registerMode />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Protected><AppLayout><Routes><Route path="/" element={<LandingRedirect />} /><Route path="/home" element={<Home />} /><Route path="/dashboard" element={<RoleRoute roles={["Staff", "Admin"]}><Dashboard /></RoleRoute>} /><Route path="/hotels" element={<HotelCatalogRoute />} /><Route path="/hotels/:hotelId" element={<HotelDetails />} /><Route path="/restaurants" element={<RestaurantCatalogRoute />} /><Route path="/restaurants/:restaurantId" element={<RestaurantDetails />} /><Route path="/rooms" element={<RoleRoute roles={["Staff", "Admin"]}><ResourcePage kind="rooms" /></RoleRoute>} /><Route path="/tables" element={<RoleRoute roles={["Staff", "Admin"]}><ResourcePage kind="tables" /></RoleRoute>} /><Route path="/reservations" element={<ReservationsRoute />} /><Route path="/manage" element={<RoleRoute roles={["Staff", "Admin"]}><Reservations manageView /></RoleRoute>} /><Route path="/combined-bookings" element={<CombinedBookingsRoute />} /><Route path="/reports" element={<RoleRoute roles={["Staff", "Admin"]}><Reports /></RoleRoute>} /><Route path="/users" element={<RoleRoute roles={["Admin"]}><Users /></RoleRoute>} /><Route path="/notifications" element={<Notifications />} /><Route path="/profile" element={<Profile />} /><Route path="*" element={<Navigate to="/home" replace />} /></Routes></AppLayout></Protected>} /></Routes>;
}
