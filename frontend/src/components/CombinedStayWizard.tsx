import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "../api";
import { canCreateReservations } from "../appAccess";
import { buildCombinedBookingPayload } from "../customerData";
import type { RestaurantTable, Room, User } from "../types";

type WizardForm = {
    room_id: string;
    check_in_date: string;
    check_out_date: string;
    table_id: string;
    reservation_date: string;
    start_time: string;
    end_time: string;
};

export const getWizardStepError = (step: number, form: WizardForm) => {
    if (step === 1 && (!form.room_id || !form.check_in_date || !form.check_out_date)) return "Choose a room and enter check-in and check-out dates.";
    if (step === 2 && (!form.table_id || !form.reservation_date || !form.start_time || !form.end_time)) return "Choose a table and enter the dining date, start time, and end time.";
    return "";
};

export function CombinedStayReview({ hotelName, roomType, roomNumber, checkIn, checkOut, pricePerNight, restaurantName, tableNumber, diningDate, startTime, endTime }: {
    hotelName: string;
    roomType?: string;
    roomNumber?: string;
    checkIn: string;
    checkOut: string;
    pricePerNight?: number;
    restaurantName: string;
    tableNumber?: string;
    diningDate: string;
    startTime: string;
    endTime: string;
}) {
    return <><p className="eyebrow">CHECK YOUR SELECTIONS</p><h2 className="combined-review-title">Review Your Complete Stay</h2><div className="combined-review-card"><h3>Hotel &amp; Room</h3><p>{hotelName}</p><p>{roomType} · Room {roomNumber}</p><p>{checkIn} → {checkOut}</p>{pricePerNight !== undefined && <strong>₱{Number(pricePerNight).toLocaleString("en-PH")}<small> per night</small></strong>}</div><div className="combined-review-card"><h3>Dining Reservation</h3><p>{restaurantName}</p><p>Table {tableNumber}</p><p>{diningDate} · {startTime}–{endTime}</p></div></>;
}

export function CombinedStayWizard({ user, onCreated }: { user: User | null; onCreated: () => void }) {
    const [rooms, setRooms] = useState<Room[]>([]); const [tables, setTables] = useState<RestaurantTable[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [step, setStep] = useState(1); const [inventoryLoading, setInventoryLoading] = useState(true); const [selectedHotelId, setSelectedHotelId] = useState(""); const [selectedRestaurantId, setSelectedRestaurantId] = useState(""); const [form, setForm] = useState({ room_id: "", check_in_date: "", check_out_date: "", table_id: "", reservation_date: "", start_time: "", end_time: "" });
    useEffect(() => { Promise.all([apiGet<Room[]>("/rooms"), apiGet<RestaurantTable[]>("/tables")]).then(([roomData, tableData]) => { setRooms(roomData); setTables(tableData); if (roomData[0]) setSelectedHotelId(String(roomData[0].hotel_id)); if (tableData[0]) setSelectedRestaurantId(String(tableData[0].restaurant_id)); }).catch(e => setError(e instanceof Error ? e.message : "Unable to load rooms and tables")).finally(() => setInventoryLoading(false)); }, []);
    const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); try { await apiPost("/combined-bookings/hotel-restaurant", buildCombinedBookingPayload({ roomId: Number(form.room_id), checkIn: form.check_in_date, checkOut: form.check_out_date, tableId: Number(form.table_id), date: form.reservation_date, startTime: form.start_time, endTime: form.end_time })); setMessage("Combined booking created"); onCreated(); setStep(1); } catch (e) { setError(e instanceof Error ? e.message : "Combined booking failed"); } };
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
        const validationError = getWizardStepError(step, form);
        if (validationError) { setError(validationError); return; }
        setStep(value => Math.min(3, value + 1));
    };
    return <section className="combined-wizard">
        <div className="combined-wizard-container">
            <header className="combined-wizard-header"><p className="eyebrow">YOUR COMPLETE GETAWAY</p><h1>Plan Your Complete Stay</h1><p>Select a room, then choose a table and dining time.</p></header>
            {message && <p className="alert success" role="status">{message}</p>}{error && <p className="combined-error" role="alert">{error}</p>}
            {inventoryLoading && <p>Loading rooms and tables...</p>}
            <div className="combined-steps">{[{ number: 1, label: "Hotel & Room" }, { number: 2, label: "Restaurant" }, { number: 3, label: "Review" }].map(item => <div key={item.number} className={`combined-step ${step === item.number ? "active" : ""} ${step > item.number ? "completed" : ""}`}><span>{step > item.number ? "✓" : item.number}</span><small>{item.label}</small></div>)}</div>
            <form className="combined-wizard-form" onSubmit={submit}>
                {step === 1 && <>
                    <p className="eyebrow">CHOOSE YOUR HOTEL</p>
                    <div className="combined-hotel-grid">{hotelIds.map(hotelId => { const hotel = rooms.find(room => room.hotel_id === hotelId)?.hotel; return <button type="button" key={hotelId} className={`combined-hotel-card ${selectedHotelId === String(hotelId) ? "selected" : ""}`} onClick={() => { setSelectedHotelId(String(hotelId)); setForm({ ...form, room_id: "" }); }} aria-pressed={selectedHotelId === String(hotelId)}><span className="combined-card-copy"><strong>{hotel?.name ?? `Hotel #${hotelId}`}</strong><small>{hotel?.address ?? ""}</small></span></button>; })}</div>
                    <p className="eyebrow combined-section-label">SELECT A ROOM</p>
                    <div className="combined-room-list">{hotelRooms.map(room => <label key={room.room_id} className={`combined-room-option ${form.room_id === String(room.room_id) ? "selected" : ""}`}><input type="radio" name="room" value={room.room_id} checked={form.room_id === String(room.room_id)} onChange={() => setForm({ ...form, room_id: String(room.room_id) })} /><span className="combined-room-copy"><strong>{room.room_type} · Room {room.room_number}</strong><small>{room.status} · Capacity {room.capacity}</small></span><strong className="combined-room-price">₱{Number(room.price_per_night).toLocaleString("en-PH")}<small>/ night</small></strong></label>)}</div>
                    <div className="combined-fields"><p className="eyebrow">DATES</p><div className="combined-field-grid"><label>Check-in<input type="date" value={form.check_in_date} onChange={event => setForm({ ...form, check_in_date: event.target.value })} required /></label><label>Check-out<input type="date" min={form.check_in_date || undefined} value={form.check_out_date} onChange={event => setForm({ ...form, check_out_date: event.target.value })} required /></label></div></div>
                </>}
                {step === 2 && <>
                    <p className="eyebrow">CHOOSE YOUR RESTAURANT</p>
                    <div className="combined-hotel-grid">{restaurantIds.map(restaurantId => { const restaurant = tables.find(table => table.restaurant_id === restaurantId)?.restaurant; return <button type="button" key={restaurantId} className={`combined-hotel-card ${selectedRestaurantId === String(restaurantId) ? "selected" : ""}`} onClick={() => { setSelectedRestaurantId(String(restaurantId)); setForm({ ...form, table_id: "" }); }} aria-pressed={selectedRestaurantId === String(restaurantId)}><span className="combined-card-copy"><strong>{restaurant?.name ?? `Restaurant #${restaurantId}`}</strong><small>{restaurant?.address ?? ""}</small></span></button>; })}</div>
                    <p className="eyebrow combined-section-label">SELECT A TABLE</p>
                    <div className="combined-room-list">{restaurantTables.map(table => <label key={table.table_id} className={`combined-room-option ${form.table_id === String(table.table_id) ? "selected" : ""}`}><input type="radio" name="table" value={table.table_id} checked={form.table_id === String(table.table_id)} onChange={() => setForm({ ...form, table_id: String(table.table_id) })} /><span className="combined-room-copy"><strong>Table {table.table_number}</strong><small>{table.status} · Capacity {table.capacity}</small></span></label>)}</div>
                    <div className="combined-fields"><p className="eyebrow">DINING DETAILS</p><div className="combined-field-grid"><label>Dining date<input type="date" min={form.check_in_date || undefined} max={form.check_out_date || undefined} value={form.reservation_date} onChange={event => setForm({ ...form, reservation_date: event.target.value })} required /></label><label>Preferred time<input type="time" value={form.start_time} onChange={event => setForm({ ...form, start_time: event.target.value })} required /></label><label>End time<input type="time" value={form.end_time} onChange={event => setForm({ ...form, end_time: event.target.value })} required /></label></div></div>
                </>}
                {step === 3 && <CombinedStayReview hotelName={selectedHotel?.name ?? (selectedRoom ? `Hotel #${selectedRoom.hotel_id}` : "—")} roomType={selectedRoom?.room_type} roomNumber={selectedRoom?.room_number} checkIn={form.check_in_date} checkOut={form.check_out_date} pricePerNight={selectedRoom?.price_per_night} restaurantName={selectedRestaurant?.name ?? (selectedTable ? `Restaurant #${selectedTable.restaurant_id}` : "—")} tableNumber={selectedTable?.table_number} diningDate={form.reservation_date} startTime={form.start_time} endTime={form.end_time} />}
                <div className="combined-form-actions">{step > 1 && <button type="button" className="combined-secondary-button" onClick={() => { setError(""); setStep(value => value - 1); }}>Back</button>}{step < 3 ? <button type="button" className="combined-primary-button" onClick={advance}>Continue</button> : <button type="submit" className="combined-primary-button" disabled={!canCreateReservations(user)}>Create Combined Booking</button>}</div>
            </form>
        </div>
    </section>;
}
