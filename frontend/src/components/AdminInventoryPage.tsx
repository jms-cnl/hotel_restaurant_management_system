import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import { defaultStatusFor, normalizeResourceStatus, resourceStatusClass, statusOptionsFor, type InventoryResourceKind } from "../types";
import { MediaManager } from "./MediaManager";

type ResourceKind = InventoryResourceKind;
type RecordData = Record<string, unknown>;
type AmenityRecord = { amenity_id: number; name: string; description?: string | null };
type FieldType = "text" | "number" | "email" | "select";
type FieldDefinition = {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    min?: number;
    options?: string[];
};
type ResourceDefinition = {
    label: string;
    singular: string;
    description: string;
    endpoint: string;
    idField: string;
    fields: FieldDefinition[];
    statusField?: string;
};
type ModalState =
    | { mode: "create" }
    | { mode: "edit" | "view"; record: RecordData }
    | null;

const definitions: Record<ResourceKind, ResourceDefinition> = {
    hotels: {
        label: "Hotels",
        singular: "Hotel",
        description: "Manage hotel information and availability.",
        endpoint: "/hotels",
        idField: "hotel_id",
        statusField: "status",
        fields: [
            { key: "name", label: "Hotel Name", type: "text", required: true },
            { key: "address", label: "Address", type: "text", required: true },
            { key: "description", label: "Description", type: "text" },
            { key: "contact_number", label: "Contact Number", type: "text", required: true },
            { key: "email", label: "Email", type: "email" },
            { key: "status", label: "Status", type: "select", required: true, options: [...statusOptionsFor("hotels")] },
        ],
    },
    restaurants: {
        label: "Restaurants",
        singular: "Restaurant",
        description: "Manage restaurant information and availability.",
        endpoint: "/restaurants",
        idField: "restaurant_id",
        statusField: "status",
        fields: [
            { key: "name", label: "Restaurant Name", type: "text", required: true },
            { key: "address", label: "Address", type: "text", required: true },
            { key: "description", label: "Description", type: "text" },
            { key: "contact_number", label: "Contact Number", type: "text", required: true },
            { key: "email", label: "Email", type: "email" },
            { key: "status", label: "Status", type: "select", required: true, options: [...statusOptionsFor("restaurants")] },
        ],
    },
    rooms: {
        label: "Rooms",
        singular: "Room",
        description: "Manage room information, capacity, pricing, and availability.",
        endpoint: "/rooms",
        idField: "room_id",
        statusField: "status",
        fields: [
            { key: "hotel_id", label: "Hotel ID", type: "number", required: true, min: 1 },
            { key: "room_number", label: "Room Number", type: "text", required: true },
            { key: "room_type", label: "Room Type", type: "select", required: true, options: ["Standard Room", "Deluxe Room", "Family Room", "Suite"] },
            { key: "capacity", label: "Capacity", type: "number", required: true, min: 1 },
            { key: "price_per_night", label: "Price per Night (₱)", type: "number", required: true, min: 0 },
            { key: "status", label: "Room Status", type: "select", required: true, options: [...statusOptionsFor("rooms")] },
        ],
    },
    tables: {
        label: "Tables",
        singular: "Table",
        description: "Manage restaurant tables, seating capacity, and availability.",
        endpoint: "/tables",
        idField: "table_id",
        statusField: "status",
        fields: [
            { key: "restaurant_id", label: "Restaurant ID", type: "number", required: true, min: 1 },
            { key: "table_number", label: "Table Number", type: "text", required: true },
            { key: "capacity", label: "Seating Capacity", type: "number", required: true, min: 1 },
            { key: "status", label: "Table Status", type: "select", required: true, options: [...statusOptionsFor("tables")] },
        ],
    },
};

const asText = (value: unknown) => value === null || value === undefined ? "" : String(value);

export function AdminInventoryPage({ kind }: { kind: ResourceKind }) {
    const definition = definitions[kind];
    const [records, setRecords] = useState<RecordData[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Statuses");
    const [modal, setModal] = useState<ModalState>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [availableAmenities, setAvailableAmenities] = useState<AmenityRecord[]>([]);
    const [linkedAmenities, setLinkedAmenities] = useState<AmenityRecord[]>([]);
    const [selectedAmenities, setSelectedAmenities] = useState<number[]>([]);
    const [roomAmenitiesLoading, setRoomAmenitiesLoading] = useState(false);
    const [roomAmenitiesLoaded, setRoomAmenitiesLoaded] = useState(false);
    const [notice, setNotice] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const pageSize = 5;

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            setRecords(await apiGet<RecordData[]>(definition.endpoint));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : `Unable to load ${definition.label.toLowerCase()}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [kind]);

    useEffect(() => {
        if (kind !== "rooms" || !modal || modal.mode === "view" || !formValues.hotel_id) {
            setAvailableAmenities([]);
            return;
        }
        let active = true;
        apiGet<AmenityRecord[]>(`/amenities?hotel_id=${encodeURIComponent(formValues.hotel_id)}`)
            .then((amenities) => { if (active) setAvailableAmenities(amenities); })
            .catch(() => { if (active) setAvailableAmenities([]); })
            .finally(() => { if (active) setRoomAmenitiesLoading(false); });
        setRoomAmenitiesLoading(true);
        return () => { active = false; };
    }, [kind, modal?.mode, formValues.hotel_id]);

    const filteredRecords = useMemo(() => {
        const query = search.trim().toLowerCase();
        return records.filter((record) => {
            const matchesSearch = !query || definition.fields.some((field) => asText(record[field.key]).toLowerCase().includes(query));
            const status = definition.statusField ? normalizeResourceStatus(record[definition.statusField], statusOptionsFor(kind)) : undefined;
            return matchesSearch && (statusFilter === "All Statuses" || status === statusFilter);
        });
    }, [records, search, statusFilter, definition, kind]);

    const statusOptions = definition.statusField ? statusOptionsFor(kind) : [];
    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visibleRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const summaryStatus = kind === "rooms" || kind === "tables" ? "Available" : "Active";
    const summaryCount = definition.statusField ? records.filter((record) => normalizeResourceStatus(record[definition.statusField!], statusOptionsFor(kind)) === summaryStatus).length : 0;

    const closeModal = () => { setModal(null); setFormValues({}); setNotice(""); setAvailableAmenities([]); setLinkedAmenities([]); setSelectedAmenities([]); setRoomAmenitiesLoaded(false); };
    const openCreate = () => {
        setFormValues(Object.fromEntries(definition.fields.map((field) => [field.key, field.key === "status" ? defaultStatusFor(kind) : ""])));
        setSelectedAmenities([]);
        setLinkedAmenities([]);
        setRoomAmenitiesLoaded(true);
        setNotice("");
        setModal({ mode: "create" });
    };
    const loadRoomAmenities = async (record: RecordData) => {
        setRoomAmenitiesLoading(true);
        setRoomAmenitiesLoaded(false);
        try {
            const amenities = await apiGet<AmenityRecord[]>(`/rooms/${record.room_id}/amenities`);
            setLinkedAmenities(amenities);
            setSelectedAmenities(amenities.map((amenity) => amenity.amenity_id));
            setRoomAmenitiesLoaded(true);
        } catch (caught) {
            setNotice(caught instanceof Error ? caught.message : "Unable to load room amenities");
        } finally {
            setRoomAmenitiesLoading(false);
        }
    };
    const openView = async (record: RecordData) => {
        setNotice("");
        setModal({ mode: "view", record });
        if (kind === "rooms") await loadRoomAmenities(record);
    };
    const openEdit = async (record: RecordData) => {
        setFormValues(Object.fromEntries(definition.fields.map((field) => [field.key, asText(record[field.key])] )));
        setSelectedAmenities([]);
        setLinkedAmenities([]);
        setNotice("");
        setModal({ mode: "edit", record });
        if (kind === "rooms") await loadRoomAmenities(record);
    };

    const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!modal || modal.mode === "view") return;
        const payload: Record<string, unknown> = {};
        for (const field of definition.fields) {
            const value = (formValues[field.key] ?? "").trim();
            if (field.required && !value) { setNotice(`Please complete the required field: ${field.label}.`); return; }
            if (field.type === "number" && value && !Number.isFinite(Number(value))) { setNotice(`${field.label} must be a number.`); return; }
            if (field.type === "number" && value && Number(value) < (field.min ?? 0)) { setNotice(`${field.label} must be at least ${field.min ?? 0}.`); return; }
            if (value) payload[field.key] = field.type === "number" ? Number(value) : value;
        }
        if (kind === "rooms" && !roomAmenitiesLoaded) { setNotice("Room amenities are still loading. Try again when they finish loading."); return; }
        setNotice("");
        let savedRecord: RecordData | undefined;
        try {
            savedRecord = modal.mode === "create"
                ? await apiPost<RecordData>(definition.endpoint, payload)
                : modal.record;
            if (modal.mode === "edit") await apiPut(`${definition.endpoint}/${modal.record[definition.idField]}`, payload);
            if (kind === "rooms") {
                const roomId = Number(savedRecord[definition.idField]);
                const currentAmenities = modal.mode === "create" ? [] : await apiGet<AmenityRecord[]>(`/rooms/${roomId}/amenities`);
                const currentIds = new Set(currentAmenities.map((amenity) => amenity.amenity_id));
                const selectedIds = new Set(selectedAmenities);
                for (const amenityId of selectedIds) if (!currentIds.has(amenityId)) await apiPost(`/rooms/${roomId}/amenities`, { amenity_id: amenityId });
                for (const amenityId of currentIds) if (!selectedIds.has(amenityId)) await apiDelete(`/rooms/${roomId}/amenities/${amenityId}`);
            }
            closeModal();
            setNotice(`${definition.singular} ${modal.mode === "create" ? "added" : "updated"}.`);
            await load();
        } catch (caught) {
            if (kind === "rooms" && modal.mode === "create") {
                savedRecord = { ...Object.fromEntries(Object.entries(payload)), ...savedRecord };
                if (savedRecord[definition.idField] !== undefined) setModal({ mode: "edit", record: savedRecord });
            }
            setNotice(caught instanceof Error ? caught.message : `Unable to save ${definition.singular.toLowerCase()}.`);
        }
    };

    const deleteRecord = async (record: RecordData) => {
        if (!window.confirm(`Delete this ${definition.singular.toLowerCase()}?`)) return;
        setError("");
        try {
            await apiDelete(`${definition.endpoint}/${record[definition.idField]}`);
            setNotice(`${definition.singular} deleted.`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : `Unable to delete ${definition.singular.toLowerCase()}.`);
        }
    };

    return <div className="admin-crud-page">
        {error && <div className="admin-crud-form-error" role="alert">{error}</div>}
        <div className="admin-crud-summary">
            <div className="admin-crud-summary-card"><span>Total {definition.label}</span><strong>{records.length}</strong></div>
            {definition.statusField && <div className="admin-crud-summary-card"><span>{summaryStatus}</span><strong>{summaryCount}</strong></div>}
        </div>

        <div className="admin-crud-panel">
            <div className="admin-crud-section-heading">
                <div><h2>{definition.label}</h2><p>{definition.description}</p></div>
                <button className="admin-crud-add" type="button" onClick={openCreate}>+ Add {definition.singular}</button>
            </div>

            {notice && !modal && <div className="admin-crud-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}

            <div className="admin-crud-toolbar">
                <input type="search" value={search} placeholder={`Search ${definition.label.toLowerCase()}...`} aria-label={`Search ${definition.label}`} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
                {definition.statusField && <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="All Statuses">All Statuses</option>{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select>}
                <span className="admin-crud-result-count">{filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}</span>
            </div>

            <div className="admin-crud-table-wrap">
                {loading ? <div className="admin-crud-empty"><h3>Loading {definition.label.toLowerCase()}...</h3></div> : visibleRecords.length === 0 ? <div className="admin-crud-empty"><span aria-hidden="true">⌕</span><h3>No records found</h3><p>{records.length === 0 ? `There are no ${definition.label.toLowerCase()} yet.` : "Try changing your search or status filter."}</p>{records.length === 0 && <button type="button" className="admin-crud-add" onClick={openCreate}>+ Add {definition.singular}</button>}</div> : <table className="admin-crud-table">
                    <thead><tr>{definition.fields.map((field) => <th key={field.key}>{field.label}</th>)}<th className="admin-crud-actions-heading">Actions</th></tr></thead>
                    <tbody>{visibleRecords.map((record) => <tr key={String(record[definition.idField])}>{definition.fields.map((field) => {
                        const value = asText(record[field.key]);
                        const canonicalStatus = field.key === definition.statusField ? normalizeResourceStatus(value, statusOptionsFor(kind)) : undefined;
                        return <td key={field.key}>{field.key === definition.statusField ? <span className={`admin-crud-status ${resourceStatusClass(value, statusOptionsFor(kind))}`}>{canonicalStatus ?? value}</span> : value || "—"}</td>;
                    })}<td><div className="admin-crud-row-actions"><button type="button" className="admin-crud-view" onClick={() => openView(record)}>View</button><button type="button" className="admin-crud-edit" onClick={() => openEdit(record)}>Edit</button><button type="button" className="admin-crud-delete" onClick={() => void deleteRecord(record)}>Delete</button></div></td></tr>)}</tbody>
                </table>}
            </div>

            {filteredRecords.length > 0 && <div className="admin-crud-pagination"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div></div>}
        </div>

        <p className="admin-crud-disclaimer">Changes are saved to the hotel management system.</p>

        {modal && <div className="admin-crud-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
            <section className="admin-crud-modal" role="dialog" aria-modal="true" aria-labelledby="admin-crud-modal-title">
                <div className="admin-crud-modal-head"><div><p className="eyebrow">ADMIN MANAGEMENT</p><h2 id="admin-crud-modal-title">{modal.mode === "create" ? `Add ${definition.singular}` : modal.mode === "edit" ? `Edit ${definition.singular}` : `${definition.singular} Details`}</h2></div><button type="button" aria-label="Close dialog" onClick={closeModal}>×</button></div>
                {modal.mode === "view" ? <>
                    <div className="admin-crud-details">{definition.fields.map((field) => <div className="admin-crud-detail-row" key={field.key}><span>{field.label}</span><strong>{asText(modal.record[field.key]) || "—"}</strong></div>)}</div>
                    {kind === "rooms" && <div className="admin-crud-amenities-details"><h3>Amenities</h3>{roomAmenitiesLoading ? <p>Loading amenities...</p> : linkedAmenities.length ? <div className="admin-crud-amenity-list">{linkedAmenities.map((amenity) => <span className="admin-crud-amenity-chip" key={amenity.amenity_id}>{amenity.name}</span>)}</div> : <p>No amenities linked to this room.</p>}</div>}
                    <MediaManager entityType={kind === "hotels" ? "hotel" : kind === "restaurants" ? "restaurant" : kind === "rooms" ? "room" : "table"} entityId={Number(modal.record[definition.idField])} manager />
                    <div className="admin-crud-form-actions"><button type="button" className="admin-crud-cancel" onClick={closeModal}>Close</button><button type="button" className="admin-crud-add" onClick={() => void openEdit(modal.record)}>Edit Record</button></div>
                </> : <form onSubmit={(event) => void saveRecord(event)}>
                    {notice && <div className="admin-crud-form-error" role="alert">{notice}</div>}
                    <div className="admin-crud-fields">{definition.fields.map((field) => <label key={field.key}><span>{field.label}{field.required && <span className="admin-crud-required"> *</span>}</span>{field.type === "select" ? <select required={field.required} value={formValues[field.key] ?? ""} onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Select {field.label}</option>{(field.options ?? []).map((option) => <option value={option} key={option}>{option}</option>)}</select> : <input type={field.type} required={field.required} min={field.type === "number" ? field.min ?? 0 : undefined} step={field.type === "number" ? "any" : undefined} value={formValues[field.key] ?? ""} onChange={(event) => { setFormValues((current) => ({ ...current, [field.key]: event.target.value })); if (kind === "rooms" && field.key === "hotel_id") { setSelectedAmenities([]); setRoomAmenitiesLoaded(true); } }} />}</label>)}</div>
                    {kind === "rooms" && <div className="admin-crud-amenities-form"><div className="admin-crud-amenities-heading"><h3>Room Amenities</h3><span>Optional</span></div><p>Select amenities available in this room. Amenities are loaded from the selected hotel.</p>{roomAmenitiesLoading ? <p>Loading amenities...</p> : availableAmenities.length ? <div className="admin-crud-amenities-options">{availableAmenities.map((amenity) => <label className="admin-crud-amenity-option" key={amenity.amenity_id}><input type="checkbox" checked={selectedAmenities.includes(amenity.amenity_id)} onChange={() => setSelectedAmenities((current) => current.includes(amenity.amenity_id) ? current.filter((id) => id !== amenity.amenity_id) : [...current, amenity.amenity_id])} /><span>{amenity.name}</span></label>)}</div> : <p>No amenities are available for this hotel.</p>}</div>}
                    <div className="admin-crud-form-actions"><button type="button" className="admin-crud-cancel" onClick={closeModal}>Cancel</button><button type="submit" className="admin-crud-add">{modal.mode === "create" ? `Add ${definition.singular}` : "Save Changes"}</button></div>
                </form>}
            </section>
        </div>}
    </div>;
}
