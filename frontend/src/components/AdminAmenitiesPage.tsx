import { useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";

type HotelRecord = { hotel_id: number; name: string };
type AmenityRecord = { amenity_id: number; hotel_id: number; name: string; description?: string | null };
type AmenityForm = { hotel_id: string; name: string; description: string };

const emptyForm: AmenityForm = { hotel_id: "", name: "", description: "" };

export function AdminAmenitiesPage() {
    const [hotels, setHotels] = useState<HotelRecord[]>([]);
    const [amenities, setAmenities] = useState<AmenityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [editing, setEditing] = useState<AmenityRecord | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<AmenityForm>(emptyForm);

    const load = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError("");
        try {
            const [nextHotels, nextAmenities] = await Promise.all([
                apiGet<HotelRecord[]>("/hotels"),
                apiGet<AmenityRecord[]>("/amenities"),
            ]);
            setHotels(nextHotels);
            setAmenities(nextAmenities);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load amenities");
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
        setForm({ ...emptyForm, hotel_id: hotels.length === 1 ? String(hotels[0].hotel_id) : "" });
        setNotice("");
        setError("");
    };

    const openEdit = (amenity: AmenityRecord) => {
        setEditing(amenity);
        setFormOpen(true);
        setForm({ hotel_id: String(amenity.hotel_id), name: amenity.name, description: amenity.description ?? "" });
        setNotice("");
        setError("");
    };

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const body = { name: form.name.trim(), description: form.description.trim() || null };
            if (editing) {
                await apiPut(`/amenities/${editing.amenity_id}`, body);
                setNotice("Amenity updated.");
            } else {
                await apiPost("/amenities", { ...body, hotel_id: Number(form.hotel_id) });
                setNotice("Amenity added.");
            }
            setEditing(null);
            setFormOpen(false);
            setForm(emptyForm);
            await load(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save amenity");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (amenity: AmenityRecord) => {
        if (!window.confirm(`Delete ${amenity.name}?`)) return;
        setDeletingId(amenity.amenity_id);
        setError("");
        setNotice("");
        try {
            await apiDelete(`/amenities/${amenity.amenity_id}`);
            setNotice("Amenity deleted.");
            await load(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to delete amenity");
        } finally {
            setDeletingId(null);
        }
    };

    const hotelName = (hotelId: number) => hotels.find((hotel) => hotel.hotel_id === hotelId)?.name ?? `Hotel ${hotelId}`;

    return <div className="admin-crud-page">
        <div className="admin-crud-summary">
            <div className="admin-crud-summary-card"><span>Total Amenities</span><strong>{amenities.length}</strong></div>
            <div className="admin-crud-summary-card"><span>Hotels</span><strong>{hotels.length}</strong></div>
        </div>
        <div className="admin-crud-panel">
            <div className="admin-crud-section-heading">
                <div><h2>Amenities</h2><p>Manage hotel amenities and their room and restaurant links.</p></div>
                {!editing && <button className="admin-crud-add" type="button" disabled={loading || saving || deletingId !== null} onClick={openCreate}>+ Add Amenity</button>}
            </div>
            {error && <div className="admin-crud-form-error" role="alert">{error}</div>}
            {notice && <div className="admin-crud-notice" role="status">{notice}</div>}
            {formOpen && <form onSubmit={(event) => void save(event)}>
                <div className="admin-crud-fields">
                    {!editing && <label><span>Hotel<span className="admin-crud-required"> *</span></span><select required value={form.hotel_id} onChange={(event) => setForm((current) => ({ ...current, hotel_id: event.target.value }))}><option value="">Select hotel</option>{hotels.map((hotel) => <option value={hotel.hotel_id} key={hotel.hotel_id}>{hotel.name}</option>)}</select></label>}
                    {editing && <div className="admin-crud-detail-row"><span>Hotel</span><strong>{hotelName(editing.hotel_id)}</strong></div>}
                    <label><span>Name<span className="admin-crud-required"> *</span></span><input required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                    <label><span>Description</span><input maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
                </div>
                <div className="admin-crud-form-actions"><button type="button" className="admin-crud-cancel" disabled={saving} onClick={() => { setEditing(null); setFormOpen(false); setForm(emptyForm); setError(""); }}>Cancel</button><button type="submit" className="admin-crud-add" disabled={loading || saving || deletingId !== null || (!editing && hotels.length === 0)}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Amenity"}</button></div>
            </form>}
            <div className="admin-crud-table-wrap">
                {loading ? <div className="admin-crud-empty" role="status"><h3>Loading amenities…</h3></div> : amenities.length === 0 ? <div className="admin-crud-empty"><span aria-hidden="true">⌕</span><h3>No amenities found</h3><p>Add an amenity to make it available for rooms and restaurants.</p></div> : <table className="admin-crud-table">
                    <thead><tr><th>Name</th><th>Hotel</th><th>Description</th><th className="admin-crud-actions-heading">Actions</th></tr></thead>
                    <tbody>{amenities.map((amenity) => <tr key={amenity.amenity_id}><td>{amenity.name}</td><td>{hotelName(amenity.hotel_id)}</td><td>{amenity.description || "—"}</td><td><div className="admin-crud-row-actions"><button className="admin-crud-edit" type="button" disabled={deletingId !== null || saving} onClick={() => openEdit(amenity)}>Edit</button><button className="admin-crud-delete" type="button" disabled={deletingId !== null || saving} onClick={() => void remove(amenity)}>{deletingId === amenity.amenity_id ? "Deleting…" : "Delete"}</button></div></td></tr>)}</tbody>
                </table>}
            </div>
        </div>
        <p className="admin-crud-disclaimer">Changes are saved to the hotel management system.</p>
    </div>;
}
