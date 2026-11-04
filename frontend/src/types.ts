export type RoleName = "Customer" | "Staff" | "Admin";

export const HOTEL_RESTAURANT_STATUSES = ["Active", "Inactive", "Suspended"] as const;
export const ROOM_TABLE_STATUSES = ["Available", "Reserved", "Occupied", "Maintenance"] as const;

export type InventoryResourceKind = "hotels" | "restaurants" | "rooms" | "tables";

export const statusOptionsFor = (kind: InventoryResourceKind) =>
    kind === "hotels" || kind === "restaurants" ? HOTEL_RESTAURANT_STATUSES : ROOM_TABLE_STATUSES;

export const defaultStatusFor = (kind: InventoryResourceKind) => statusOptionsFor(kind)[0];

export const normalizeResourceStatus = (value: unknown, allowedStatuses: readonly string[]) => {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().toLocaleLowerCase();
    return allowedStatuses.find((status) => status.toLocaleLowerCase() === normalized);
};

export const resourceStatusClass = (value: unknown, allowedStatuses: readonly string[]) => {
    const canonical = normalizeResourceStatus(value, allowedStatuses);
    return canonical ? canonical.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-") : "unknown";
};

export type User = {
    user_id: string;
    role_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    role?: { role_name: string } | null;
};

export type Hotel = { hotel_id: number; name: string; address: string; description?: string | null; contact_number: string; email?: string | null; status: string };
export type Restaurant = { restaurant_id: number; name: string; address: string; description?: string | null; contact_number: string; email?: string | null; status: string };
export type Room = { room_id: number; hotel_id: number; room_number: string; room_type: string; capacity: number; price_per_night: number; status: string; hotel?: Hotel };
export type RestaurantTable = { table_id: number; restaurant_id: number; table_number: string; capacity: number; status: string; restaurant?: Restaurant };
export type ReservationStatus = "Pending" | "Confirmed" | "Rejected" | "Completed" | "Cancelled";
export type Reservation = {
    reservation_id: number;
    user_id: string;
    reservation_type: "HOTEL" | "RESTAURANT";
    room_id?: number | null;
    table_id?: number | null;
    check_in_date?: string | null;
    check_out_date?: string | null;
    reservation_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    status: ReservationStatus;
    special_request?: string | null;
    combined_booking_id?: number | null;
    created_at?: string;
    user?: User | null;
    room?: Room;
    restaurant_table?: RestaurantTable;
};
export type ReservationHistory = { history_id: number; reservation_id: number; changed_by?: string | null; status: ReservationStatus; changed_at: string; remarks?: string | null };
export type CombinedBooking = { combined_booking_id: number; user_id: string; status: ReservationStatus; created_at: string; user?: User | null; reservation?: Reservation[] };
export type Media = { media_id: number; image_type: "JPG" | "PNG" | "WEBP"; file_size: number; storage_path: string; is_primary: boolean; display_order: number; created_at: string; url: string };
export type ApiError = Error & { status?: number };
