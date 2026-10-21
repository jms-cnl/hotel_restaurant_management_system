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
