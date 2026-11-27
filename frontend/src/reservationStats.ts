import type { CombinedBooking, Reservation } from "./types";

const isActiveStatus = (status: string) => ["pending", "confirmed"].includes(status.trim().toLowerCase());

const reservationStartDate = (reservation: Reservation) => reservation.reservation_type === "HOTEL"
    ? reservation.check_in_date
    : reservation.reservation_date;

const dateIsUpcoming = (date: string | null | undefined, today: string) => Boolean(date && date.slice(0, 10) >= today);

export const getTodayInManila = (now = new Date()) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(now);

export type CustomerBookingStats = {
    hotelBookings: number;
    diningBookings: number;
    combinedBookings: number;
    totalBookings: number;
};

export const countCustomerBookingStats = (
    reservations: readonly Reservation[],
    combinedBookings: readonly CombinedBooking[],
): CustomerBookingStats => {
    const standaloneReservations = reservations.filter((reservation) => reservation.combined_booking_id == null);
    return {
        hotelBookings: standaloneReservations.filter((reservation) => reservation.reservation_type === "HOTEL").length,
        diningBookings: standaloneReservations.filter((reservation) => reservation.reservation_type === "RESTAURANT").length,
        combinedBookings: combinedBookings.length,
        totalBookings: standaloneReservations.length + combinedBookings.length,
    };
};

export const countUpcomingBookings = (
    reservations: readonly Reservation[],
    combinedBookings: readonly CombinedBooking[],
    today: string,
) => {
    const standaloneCount = reservations.filter((reservation) =>
        reservation.combined_booking_id == null &&
        isActiveStatus(reservation.status) &&
        dateIsUpcoming(reservationStartDate(reservation), today),
    ).length;

    const combinedCount = combinedBookings.filter((booking) =>
        isActiveStatus(booking.status) &&
        Boolean(booking.reservation?.some((reservation) => dateIsUpcoming(reservationStartDate(reservation), today))),
    ).length;

    return standaloneCount + combinedCount;
};
