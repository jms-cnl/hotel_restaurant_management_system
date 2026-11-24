import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api";
import type { Hotel } from "../types";
import { PropertySettingsForm, type PropertySettingsValues } from "./PropertySettingsForm";

export function AdminPropertySettingsPage() {
    const [hotel, setHotel] = useState<Hotel | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;
        apiGet<Hotel[]>("/hotels")
            .then(hotels => {
                if (!active) return;
                if (hotels.length !== 1) {
                    setError(`Expected exactly one hotel, but found ${hotels.length}.`);
                    return;
                }
                setHotel(hotels[0]);
            })
            .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load property settings."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const save = async (values: PropertySettingsValues) => {
        if (!hotel) return;
        setSaving(true);
        setError("");
        setNotice("");
        try {
            setHotel(await apiPut<Hotel>(`/hotels/${hotel.hotel_id}`, values));
            setNotice("Property settings saved.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save property settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <section className="admin-crud-page"><p role="status">Loading property settings…</p></section>;
    if (!hotel) return <section className="admin-crud-page"><div className="admin-crud-form-error" role="alert">{error || "The hotel could not be loaded."}</div></section>;
    return <PropertySettingsForm hotel={hotel} onSave={values => void save(values)} saving={saving} error={error} notice={notice} />;
}
