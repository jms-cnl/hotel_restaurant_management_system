import type { Reservation } from "./types.ts";

export type CustomerProfileStats = {
    totalBookings: number;
    hotelBookings: number;
    diningBookings: number;
    upcomingBookings: number;
    completedBookings: number;
};

type CustomerBooking = {
    reservations: Reservation[];
};

export const deriveCustomerProfileStats = (
    reservations: readonly Reservation[] | null | undefined,
    today: string,
): CustomerProfileStats | null => {
    if (!reservations) return null;

    const bookings = new Map<string, CustomerBooking>();
    for (const reservation of reservations) {
        const key = reservation.combined_booking_id == null
            ? `reservation:${reservation.reservation_id}`
            : `combined:${reservation.combined_booking_id}`;
        const booking = bookings.get(key) ?? { reservations: [] };
        booking.reservations.push(reservation);
        bookings.set(key, booking);
    }

    let hotelBookings = 0;
    let diningBookings = 0;
    let upcomingBookings = 0;
    let completedBookings = 0;

    for (const { reservations: children } of bookings.values()) {
        if (children.some((item) => item.reservation_type === "HOTEL")) hotelBookings += 1;
        if (children.some((item) => item.reservation_type === "RESTAURANT")) diningBookings += 1;

        const completed = children.some((item) => item.status === "Completed");
        if (completed) {
            completedBookings += 1;
            continue;
        }

        const upcoming = children.some((item) => {
            const date = item.reservation_type === "HOTEL" ? item.check_in_date : item.reservation_date;
            return (item.status === "Pending" || item.status === "Confirmed") && Boolean(date && date.slice(0, 10) >= today);
        });
        if (upcoming) upcomingBookings += 1;
    }

    return {
        totalBookings: bookings.size,
        hotelBookings,
        diningBookings,
        upcomingBookings,
        completedBookings,
    };
};
