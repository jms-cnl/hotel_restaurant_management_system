export type ReservationType = "HOTEL" | "RESTAURANT";

const dateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export function dashboardReservationReportPath(type: ReservationType, now = new Date()): string {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const query = new URLSearchParams({
        type,
        date_from: dateKey(start),
        date_to: dateKey(end),
    });
    return `/reports/reservations?${query.toString()}`;
}

export function displayGuestCount(value: unknown): string {
    return value === null || value === undefined || value === "" ? "—" : String(value);
}

export function formatOccupancyRate(rate: number): string {
    const percentage = Number((rate * 100).toFixed(1));
    return `${percentage}%`;
}
