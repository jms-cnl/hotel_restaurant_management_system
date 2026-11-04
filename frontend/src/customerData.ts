export type HotelReservationPayload = {
    reservation_type: "HOTEL";
    room_id: number;
    check_in_date: string;
    check_out_date: string;
};

export type RestaurantReservationPayload = {
    reservation_type: "RESTAURANT";
    table_id: number;
    reservation_date: string;
    start_time: string;
    end_time: string;
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

const placeFromAddress = (address: string | null | undefined) => address?.split(",")[0]?.trim() ?? "";

export const getAddressLocations = (resources: readonly { address?: string | null }[]) =>
    [...new Set(resources.map((resource) => placeFromAddress(resource.address)).filter(Boolean))];

export const getBudgetTier = (rate: number): BudgetTier => {
    if (rate <= BUDGET_TIERS[0].max) return "budget-friendly";
    if (rate <= BUDGET_TIERS[1].max) return "moderate";
    return "premium";
};

const matchesCommonFilters = (resource: AddressableResource, filters: ListingFilters) => {
    const query = normalized(filters.search);
    const location = normalized(filters.location);
    const resourceLocation = normalized(placeFromAddress(resource.address));
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

export const buildHotelReservationPayload = (
    roomId: number,
    checkIn: string,
    checkOut: string
): HotelReservationPayload => ({
    reservation_type: "HOTEL",
    room_id: roomId,
    check_in_date: checkIn,
    check_out_date: checkOut,
});

export const buildRestaurantReservationPayload = (
    tableId: number,
    date: string,
    startTime: string,
    endTime: string
): RestaurantReservationPayload => ({
    reservation_type: "RESTAURANT",
    table_id: tableId,
    reservation_date: date,
    start_time: startTime,
    end_time: endTime,
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
