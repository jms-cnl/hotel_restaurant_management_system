export type HotelReservationPayload = {
    reservation_type: "HOTEL";
    room_id: number;
    check_in_date: string;
    check_out_date: string;
    special_request?: string | null;
};

export type RestaurantReservationPayload = {
    reservation_type: "RESTAURANT";
    table_id: number;
    reservation_date: string;
    start_time: string;
    end_time: string;
    special_request?: string | null;
};

export type CombinedBookingPayload = {
    hotel_reservation: Omit<HotelReservationPayload, "reservation_type">;
    restaurant_reservation: Omit<RestaurantReservationPayload, "reservation_type">;
};

export const BUDGET_TIERS = [
    { value: "budget-friendly", label: "Budget-friendly", min: 0, max: 2500 },
    { value: "moderate", label: "Moderate", min: 2500, max: 5000 },
    { value: "premium", label: "Premium", min: 5000, max: Number.POSITIVE_INFINITY },
] as const;

export type BudgetTier = typeof BUDGET_TIERS[number]["value"];
export type ListingFilters = { search?: string; location?: string; availability?: string };
export type HotelListingFilters = ListingFilters & { budgetTier?: string };

type AddressableResource = { name: string; address?: string | null; status?: string | null };
type HotelResource = AddressableResource & { hotel_id: number };
type RestaurantResource = AddressableResource & { restaurant_id: number };
type RoomResource = { hotel_id: number; price_per_night: number; status: string };
type TableResource = { restaurant_id: number; status: string };

const normalized = (value: string | null | undefined) => value?.trim().toLocaleLowerCase() ?? "";

export const getAddressCity = (address: string | null | undefined) => {
    const segments = address?.split(",").map((segment) => segment.trim()).filter(Boolean) ?? [];
    return segments.length < 2 ? "" : segments[segments.length - 2];
};

export const getAddressLocations = (resources: readonly { address?: string | null }[]) => {
    const byNormalizedCity = new Map<string, string>();
    resources.forEach((resource) => {
        const city = getAddressCity(resource.address);
        const key = normalized(city);
        if (key && !byNormalizedCity.has(key)) byNormalizedCity.set(key, city);
    });
    return [...byNormalizedCity.values()];
};

export const getBudgetTier = (rate: number): BudgetTier => {
    if (rate <= BUDGET_TIERS[0].max) return "budget-friendly";
    if (rate <= BUDGET_TIERS[1].max) return "moderate";
    return "premium";
};

const matchesCommonFilters = (resource: AddressableResource, filters: ListingFilters) => {
    const query = normalized(filters.search);
    const location = normalized(filters.location);
    const resourceLocation = normalized(getAddressCity(resource.address));
    const matchesSearch = !query || `${resource.name} ${resource.address ?? ""}`.toLocaleLowerCase().includes(query);
    const matchesLocation = !location || location === "all" || resourceLocation === location;
    return matchesSearch && matchesLocation;
};

const matchesAvailability = (available: boolean, availability: string | undefined) => {
    const selected = normalized(availability);
    return !selected || selected === "all" || (selected === "available" ? available : !available);
};

const lowestAvailableRoomRate = (hotelId: number, rooms: readonly RoomResource[]) => {
    const rates = rooms
        .filter((room) => room.hotel_id === hotelId && normalized(room.status) === "available")
        .map((room) => Number(room.price_per_night))
        .filter(Number.isFinite);
    return rates.length ? Math.min(...rates) : null;
};

export const filterHotels = <T extends HotelResource>(
    hotels: readonly T[],
    rooms: readonly RoomResource[],
    filters: HotelListingFilters,
): T[] => hotels.filter((hotel) => {
    const availableRooms = rooms.filter((room) => room.hotel_id === hotel.hotel_id && normalized(room.status) === "available");
    const available = normalized(hotel.status) === "active" && availableRooms.length > 0;
    const rate = lowestAvailableRoomRate(hotel.hotel_id, rooms);
    const selectedBudget = normalized(filters.budgetTier);
    const matchesBudget = !selectedBudget || selectedBudget === "all" || (rate !== null && getBudgetTier(rate) === selectedBudget);
    return matchesCommonFilters(hotel, filters) && matchesAvailability(available, filters.availability) && matchesBudget;
});

export const filterRestaurants = <T extends RestaurantResource>(
    restaurants: readonly T[],
    tables: readonly TableResource[],
    filters: ListingFilters,
): T[] => restaurants.filter((restaurant) => {
    const available = normalized(restaurant.status) === "active" && tables.some((table) =>
        table.restaurant_id === restaurant.restaurant_id && normalized(table.status) === "available");
    return matchesCommonFilters(restaurant, filters) && matchesAvailability(available, filters.availability);
});

export const filterResources = <T extends { name: string; address?: string | null; status?: string | null }>(
    resources: readonly T[],
    search: string,
    status: string
): T[] => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const normalizedStatus = status.trim().toLocaleLowerCase();

    return resources.filter((resource) => {
        const matchesSearch = !normalizedSearch ||
            `${resource.name} ${resource.address ?? ""}`.toLocaleLowerCase().includes(normalizedSearch);
        const matchesStatus = !normalizedStatus || normalizedStatus === "all" ||
            resource.status?.toLocaleLowerCase() === normalizedStatus;
        return matchesSearch && matchesStatus;
    });
};

export const filterReservations = <T extends { reservation_type: string; status: string }>(
    reservations: readonly T[],
    category: string,
    status: string
): T[] => reservations.filter((reservation) =>
    (category === "all" || reservation.reservation_type === category) &&
    (status === "all" || reservation.status === status)
);

export const isVenueBookable = (status: string | null | undefined): boolean =>
    status?.trim().toLocaleLowerCase() === "active";

export const canCancelReservation = (reservation: { status: string; combined_booking_id?: number | null }) =>
    reservation.combined_booking_id == null &&
    ["pending", "confirmed"].includes(normalized(reservation.status));

export const canCancelCombinedBooking = (status: string) =>
    ["pending", "confirmed"].includes(normalized(status));

export const isUpcomingBooking = (status: string, startDate: string | null | undefined, today: string) =>
    ["pending", "confirmed"].includes(normalized(status)) && Boolean(startDate) && startDate! > today;

export const claimRoomMediaRefresh = (roomId: number, attemptedRoomIds: Set<number>) => {
    if (attemptedRoomIds.has(roomId)) return false;
    attemptedRoomIds.add(roomId);
    return true;
};

export const refreshRoomMediaOnce = async <T>(
    roomId: number,
    attemptedRoomIds: Set<number>,
    fetchMedia: (roomId: number) => Promise<T[]>,
): Promise<T[]> => {
    if (!claimRoomMediaRefresh(roomId, attemptedRoomIds)) return [];
    try { return await fetchMedia(roomId); }
    catch { return []; }
};

export const mergeRoomMedia = <T>(current: Record<number, T[]>, roomId: number, media: T[]) => ({
    ...current,
    [roomId]: media,
});

export const combinedVenueLabel = (name: string | undefined, lookupFailed: boolean, fallback: string) =>
    name ?? (lookupFailed ? "Venue details unavailable" : fallback);

export const collectionState = (error: string, count: number): "unavailable" | "populated" | "empty" =>
    error ? "unavailable" : count > 0 ? "populated" : "empty";

export const countWhenAvailable = (count: number, ...sourcesUnavailable: boolean[]): number | null =>
    sourcesUnavailable.some(Boolean) ? null : count;

export const buildHotelReservationPayload = (
    roomId: number,
    checkIn: string,
    checkOut: string,
    specialRequest?: string
): HotelReservationPayload => ({
    reservation_type: "HOTEL",
    room_id: roomId,
    check_in_date: checkIn,
    check_out_date: checkOut,
    ...(specialRequest !== undefined ? { special_request: specialRequest.trim() || null } : {}),
});

export const buildRestaurantReservationPayload = (
    tableId: number,
    date: string,
    startTime: string,
    endTime: string,
    specialRequest?: string
): RestaurantReservationPayload => ({
    reservation_type: "RESTAURANT",
    table_id: tableId,
    reservation_date: date,
    start_time: startTime,
    end_time: endTime,
    ...(specialRequest !== undefined ? { special_request: specialRequest.trim() || null } : {}),
});

export const buildCombinedBookingPayload = (input: {
    roomId: number;
    checkIn: string;
    checkOut: string;
    tableId: number;
    date: string;
    startTime: string;
    endTime: string;
}): CombinedBookingPayload => ({
    hotel_reservation: {
        room_id: input.roomId,
        check_in_date: input.checkIn,
        check_out_date: input.checkOut,
    },
    restaurant_reservation: {
        table_id: input.tableId,
        reservation_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
    },
});
