import type { CustomerBookingStats } from "./reservationStats";
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
    bookingCounts: CustomerBookingStats | null | undefined,
    upcomingBookings: number | null | undefined,
): CustomerProfileStats | null => {
    if (!reservations || !bookingCounts || upcomingBookings == null) return null;

    const bookings = new Map<string, CustomerBooking>();
    for (const reservation of reservations) {
        const key = reservation.combined_booking_id == null
            ? `reservation:${reservation.reservation_id}`
            : `combined:${reservation.combined_booking_id}`;
        const booking = bookings.get(key) ?? { reservations: [] };
        booking.reservations.push(reservation);
        bookings.set(key, booking);
    }

    let completedBookings = 0;

    for (const { reservations: children } of bookings.values()) {
        const completed = children.some((item) => item.status === "Completed");
        if (completed) {
            completedBookings += 1;
            continue;
        }

    }

    return {
        totalBookings: bookingCounts.totalBookings,
        hotelBookings: bookingCounts.hotelBookings,
        diningBookings: bookingCounts.diningBookings,
        upcomingBookings,
        completedBookings,
    };
};
