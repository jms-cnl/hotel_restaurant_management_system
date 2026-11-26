import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { buildCombinedBookingPayload, isValidDateRange, isValidTimeRange, isVenueBookable } from "../customerData";
import { createCombinedWizardSteps, type CombinedWizardForm, type WizardStep } from "../combinedWizardSteps";
import type { CombinedBooking, RestaurantTable, Room } from "../types";

const initialForm: CombinedWizardForm = { roomId: "", checkIn: "", checkOut: "", tableId: "", date: "", startTime: "", endTime: "" };

export function CustomerCombinedBookings() {
    const [items, setItems] = useState<CombinedBooking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [form, setForm] = useState(initialForm);
    const [activeStep, setActiveStep] = useState<WizardStep>(() => createCombinedWizardSteps());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [optionsError, setOptionsError] = useState("");
    const [message, setMessage] = useState("");

    const load = () => {
        setLoading(true);
        setError("");
        setOptionsError("");
        const bookings = apiGet<CombinedBooking[]>("/combined-bookings")
            .then(setItems)
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load combined bookings"));
        const options = Promise.all([apiGet<Room[]>("/rooms"), apiGet<RestaurantTable[]>("/tables")])
            .then(([roomRows, tableRows]) => { setRooms(roomRows); setTables(tableRows); })
            .catch((caught: unknown) => setOptionsError(caught instanceof Error ? caught.message : "Booking options are unavailable"));
        return Promise.all([bookings, options]).finally(() => setLoading(false));
    };
    useEffect(() => { void load(); }, []);

    const availableRooms = rooms.filter((room) => room.status.toLowerCase() === "available" && isVenueBookable(room.hotel?.status));
    const availableTables = tables.filter((table) => table.status.toLowerCase() === "available" && isVenueBookable(table.restaurant?.status));
    const wizardContext = {
        form,
        rooms: availableRooms,
        tables: availableTables,
        update: (field: keyof CombinedWizardForm, value: string) => setForm((current) => ({ ...current, [field]: value })),
    };
    const advance = () => {
        if (!activeStep.canAdvance(form)) return;
        const next = activeStep.next();
        if (next) { setActiveStep(next); setError(""); }
    };
    const goBack = () => {
        const previous = activeStep.previous();
        if (previous) { setActiveStep(previous); setError(""); }
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (activeStep.id !== "review") return;
        if (!isValidDateRange(form.checkIn, form.checkOut)) { setError("Check-out must be after check-in."); return; }
        if (!isValidTimeRange(form.startTime, form.endTime)) { setError("End time must be after start time."); return; }
        setSaving(true);
        try {
            await apiPost("/combined-bookings/hotel-restaurant", buildCombinedBookingPayload({
                roomId: Number(form.roomId), checkIn: form.checkIn, checkOut: form.checkOut,
                tableId: Number(form.tableId), date: form.date, startTime: form.startTime, endTime: form.endTime,
            }));
            setMessage("Combined booking request sent.");
            setForm(initialForm);
            setActiveStep(createCombinedWizardSteps());
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to create combined booking");
        } finally { setSaving(false); }
    };

    return <section className="customer-combined-bookings">
        <div className="reservations-heading"><div><p className="eyebrow">STAY AND DINE</p><h1>Combined bookings</h1><p>Request one room and one restaurant table together.</p></div><Link to="/hotels" className="combined-stay-button">Browse Maison Valment</Link></div>
        {error && <div className="alert error customer-alert" role="alert">{error}</div>}
        {optionsError && <div className="alert error customer-alert" role="alert">{optionsError}. Your existing combined bookings are still shown.</div>}
        {message && <div className="alert success customer-alert" role="status">{message}</div>}
        <div className="combined-booking-list">
            {loading ? <div className="customer-empty-state">Loading combined bookings…</div> : items.length ? items.map((item) => <article className="booking-item combined-booking-card" key={item.combined_booking_id}>
                <p className="eyebrow">COMBINED BOOKING · #{item.combined_booking_id}</p><h2>{item.reservation?.length ?? 0} reservation items</h2><p>Status: <strong>{item.status}</strong></p><small>Requested {item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                {item.reservation?.map((reservation) => <div className="combined-booking-child" key={reservation.reservation_id}><span>{reservation.reservation_type === "HOTEL" ? "Hotel stay" : "Restaurant table"}</span><strong>{reservation.reservation_type === "HOTEL" ? `${reservation.check_in_date ?? ""} – ${reservation.check_out_date ?? ""}` : `${reservation.reservation_date ?? ""} · ${reservation.start_time ?? ""}–${reservation.end_time ?? ""}`}</strong><span className={`reservation-status ${reservation.status.toLowerCase()}`}>{reservation.status}</span></div>)}
            </article>) : <div className="customer-empty-state"><h2>No combined bookings yet</h2><p>Your requests for a stay and table together will appear here.</p></div>}
        </div>
        <form className="customer-booking-form combined-customer-form combined-wizard" onSubmit={submit}>
            <p className="eyebrow">MAKE A REQUEST</p><h2>Plan a stay and a meal</h2>
            <div className="combined-wizard-progress"><span>STEP {activeStep.position} OF 3</span><strong>{activeStep.title}</strong><progress max={3} value={activeStep.position} aria-label="Combined booking progress" /></div>
            {activeStep.render(wizardContext)}
            {(!availableRooms.length || !availableTables.length) && <p className="customer-form-note">The system needs an available room and table before a combined request can be submitted.</p>}
            <div className="combined-wizard-actions">
                {activeStep.previous() && <button className="combined-secondary-button" type="button" onClick={goBack}>Back</button>}
                {activeStep.id === "review"
                    ? <button className="combined-primary-button" type="submit" disabled={saving || !availableRooms.length || !availableTables.length}>{saving ? "Sending…" : "Request combined booking"}</button>
                    : <button className="combined-primary-button" type="button" onClick={advance} disabled={!activeStep.canAdvance(form)}>Continue</button>}
            </div>
        </form>
    </section>;
}
