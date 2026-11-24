import { useState, type FormEvent } from "react";
import { HOTEL_RESTAURANT_STATUSES, type Hotel } from "../types";

export type PropertySettingsValues = Pick<Hotel, "name" | "address" | "description" | "contact_number" | "email" | "status">;

export function PropertySettingsForm({
    hotel,
    onSave,
    saving = false,
    error,
    notice,
}: {
    hotel: Hotel;
    onSave: (values: PropertySettingsValues) => void;
    saving?: boolean;
    error?: string;
    notice?: string;
}) {
    const [values, setValues] = useState<PropertySettingsValues>({
        name: hotel.name,
        address: hotel.address,
        description: hotel.description ?? "",
        contact_number: hotel.contact_number,
        email: hotel.email ?? "",
        status: hotel.status,
    });

    const update = (field: keyof PropertySettingsValues, value: string) =>
        setValues(current => ({ ...current, [field]: value }));

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSave(values);
    };

    return <section className="admin-crud-page property-settings-page">
        <div className="page-heading"><h1>Property settings</h1></div>
        <div className="admin-crud-panel">
            <div className="admin-crud-section-heading"><div><h2>Hotel details</h2><p>Edit the existing hotel profile.</p></div></div>
            {error && <div className="admin-crud-form-error" role="alert">{error}</div>}
            {notice && <div className="admin-crud-notice" role="status">{notice}</div>}
            <form onSubmit={submit}>
                <div className="admin-crud-fields">
                    <label><span>Hotel name *</span><input name="name" required value={values.name} onChange={event => update("name", event.target.value)} /></label>
                    <label><span>Address *</span><input name="address" required value={values.address} onChange={event => update("address", event.target.value)} /></label>
                    <label><span>Description</span><input name="description" value={values.description ?? ""} onChange={event => update("description", event.target.value)} /></label>
                    <label><span>Contact number *</span><input name="contact_number" required value={values.contact_number} onChange={event => update("contact_number", event.target.value)} /></label>
                    <label><span>Email</span><input name="email" type="email" value={values.email ?? ""} onChange={event => update("email", event.target.value)} /></label>
                    <label><span>Status *</span><select name="status" required value={values.status} onChange={event => update("status", event.target.value)}>{HOTEL_RESTAURANT_STATUSES.map(status => <option value={status} key={status}>{status}</option>)}</select></label>
                </div>
                <div className="admin-crud-form-actions"><button type="submit" className="admin-crud-add" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
            </form>
        </div>
    </section>;
}
