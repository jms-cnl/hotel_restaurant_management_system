import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../api";
import { canChangeUserRole, confirmRoleChange, staffUsers, type AdminManagementUser } from "../adminManagement";
import { useAuth } from "../auth";

type RestaurantRecord = { restaurant_id: number; name: string };
type StaffAssignment = {
    user_id: string;
    restaurant_id: number;
    user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
    restaurant?: { name?: string | null } | null;
};

const fullName = (firstName?: string | null, lastName?: string | null) => [firstName, lastName].filter(Boolean).join(" ").trim();

export function AdminUsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<AdminManagementUser[]>([]);
    const [restaurants, setRestaurants] = useState<RestaurantRecord[]>([]);
    const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [assignmentDeletingKey, setAssignmentDeletingKey] = useState<string | null>(null);
    const [staffId, setStaffId] = useState("");
    const [restaurantId, setRestaurantId] = useState("");

    const staff = useMemo(() => staffUsers(users), [users]);

    const load = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError("");
        try {
            const [nextUsers, nextRestaurants, nextAssignments] = await Promise.all([
                apiGet<AdminManagementUser[]>("/admin/users"),
                apiGet<RestaurantRecord[]>("/restaurants"),
                apiGet<StaffAssignment[]>("/staff-assignments"),
            ]);
            setUsers(nextUsers);
            setRestaurants(nextRestaurants);
            setAssignments(nextAssignments);
            setStaffId((current) => current && nextUsers.some((item) => item.user_id === current && item.role === "Staff") ? current : "");
            setRestaurantId((current) => current && nextRestaurants.some((item) => String(item.restaurant_id) === current) ? current : "");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load users and assignments");
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const changeRole = async (target: AdminManagementUser, role: string) => {
        if (!canChangeUserRole(target.user_id, currentUser?.user_id, target.role) || role === target.role) return;
        if (!confirmRoleChange(target.role, role, (message) => window.confirm(message))) return;
        setRoleSavingId(target.user_id);
        setError("");
        setNotice("");
        try {
            await apiPatch(`/admin/users/${encodeURIComponent(target.user_id)}/role`, { role });
            setNotice(`${fullName(target.first_name, target.last_name) || target.email} role updated.`);
            await load(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to update user role");
        } finally {
            setRoleSavingId(null);
        }
    };

    const addAssignment = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAssignmentSaving(true);
        setError("");
        setNotice("");
        try {
            await apiPost("/staff-assignments", { user_id: staffId, restaurant_id: Number(restaurantId) });
            setNotice("Staff assignment added.");
            await load(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to add staff assignment");
        } finally {
            setAssignmentSaving(false);
        }
    };

    const removeAssignment = async (assignment: StaffAssignment) => {
        const key = `${assignment.user_id}:${assignment.restaurant_id}`;
        setAssignmentDeletingKey(key);
        setError("");
        setNotice("");
        try {
            await apiDelete(`/staff-assignments/${encodeURIComponent(assignment.user_id)}/${assignment.restaurant_id}`);
            setNotice("Staff assignment removed.");
            await load(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to remove staff assignment");
        } finally {
            setAssignmentDeletingKey(null);
        }
    };

    return <div className="admin-crud-page">
        <div className="admin-crud-summary">
            <div className="admin-crud-summary-card"><span>Total Users</span><strong>{users.length}</strong></div>
            <div className="admin-crud-summary-card"><span>Staff</span><strong>{staff.length}</strong></div>
            <div className="admin-crud-summary-card"><span>Assignments</span><strong>{assignments.length}</strong></div>
        </div>
        <div className="admin-crud-panel">
            <div className="admin-crud-section-heading"><div><h2>Users</h2><p>Review accounts and update Staff or Customer roles.</p></div></div>
            {error && <div className="admin-crud-form-error" role="alert">{error}</div>}
            {notice && <div className="admin-crud-notice" role="status">{notice}</div>}
            <div className="admin-crud-table-wrap">
                {loading ? <div className="admin-crud-empty" role="status"><h3>Loading users…</h3></div> : users.length === 0 ? <div className="admin-crud-empty"><h3>No users found</h3></div> : <table className="admin-crud-table">
                    <thead><tr><th>User</th><th>Email</th><th>Role</th></tr></thead>
                    <tbody>{users.map((item) => <tr key={item.user_id}>
                        <td>{fullName(item.first_name, item.last_name) || "—"}</td>
                        <td>{item.email}</td>
                        <td>{canChangeUserRole(item.user_id, currentUser?.user_id, item.role) ? <div className="admin-crud-role-control"><select aria-label={`Role for ${item.email}`} value={item.role ?? ""} disabled={roleSavingId !== null || assignmentSaving || assignmentDeletingKey !== null} onChange={(event) => void changeRole(item, event.target.value)}><option value="Staff">Staff</option><option value="Customer">Customer</option></select>{roleSavingId === item.user_id && <span role="status">Saving…</span>}</div> : <span>{item.role ?? "Unknown"}</span>}</td>
                    </tr>)}</tbody>
                </table>}
            </div>
        </div>

        <div className="admin-crud-panel">
            <div className="admin-crud-section-heading"><div><h2>Staff Assignments</h2><p>Assign Staff to the restaurants they manage.</p></div></div>
            <form className="admin-crud-toolbar" onSubmit={(event) => void addAssignment(event)}>
                <label>Staff<select required value={staffId} onChange={(event) => setStaffId(event.target.value)} disabled={loading || assignmentSaving || roleSavingId !== null || assignmentDeletingKey !== null}><option value="">Select Staff</option>{staff.map((item) => <option key={item.user_id} value={item.user_id}>{fullName(item.first_name, item.last_name) || item.email} · {item.email}</option>)}</select></label>
                <label>Restaurant<select required value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} disabled={loading || assignmentSaving || roleSavingId !== null || assignmentDeletingKey !== null}><option value="">Select restaurant</option>{restaurants.map((item) => <option key={item.restaurant_id} value={item.restaurant_id}>{item.name}</option>)}</select></label>
                <button className="admin-crud-add" type="submit" disabled={loading || assignmentSaving || roleSavingId !== null || assignmentDeletingKey !== null || staff.length === 0 || restaurants.length === 0}>{assignmentSaving ? "Assigning…" : "Assign Staff"}</button>
            </form>
            <div className="admin-crud-table-wrap">
                {loading ? <div className="admin-crud-empty" role="status"><h3>Loading assignments…</h3></div> : assignments.length === 0 ? <div className="admin-crud-empty"><h3>No assignments found</h3><p>Choose a Staff user and restaurant to create an assignment.</p></div> : <table className="admin-crud-table">
                    <thead><tr><th>Staff</th><th>Email</th><th>Restaurant</th><th className="admin-crud-actions-heading">Actions</th></tr></thead>
                    <tbody>{assignments.map((assignment) => {
                        const key = `${assignment.user_id}:${assignment.restaurant_id}`;
                        return <tr key={key}><td>{fullName(assignment.user?.first_name, assignment.user?.last_name) || "—"}</td><td>{assignment.user?.email ?? "—"}</td><td>{assignment.restaurant?.name ?? restaurants.find((restaurant) => restaurant.restaurant_id === assignment.restaurant_id)?.name ?? `Restaurant ${assignment.restaurant_id}`}</td><td><div className="admin-crud-row-actions"><button type="button" className="admin-crud-delete" disabled={assignmentDeletingKey !== null || assignmentSaving || roleSavingId !== null} onClick={() => void removeAssignment(assignment)}>{assignmentDeletingKey === key ? "Removing…" : "Remove"}</button></div></td></tr>;
                    })}</tbody>
                </table>}
            </div>
        </div>
        <p className="admin-crud-disclaimer">Role and assignment changes are saved to the hotel management system.</p>
    </div>;
}
