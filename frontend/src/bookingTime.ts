export const formatReservationTime = (time: string | null | undefined) =>
    time && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(time)
        ? time.slice(0, 5)
        : "—";

export const formatAdminCombinedBookingDateTime = (
    diningDate: string | null | undefined,
    startTime: string | null | undefined,
    endTime: string | null | undefined,
): string | null => {
    if (!diningDate) return null;
    const formattedEndTime = endTime ? formatReservationTime(endTime) : "";
    const timeRange = formattedEndTime && formattedEndTime !== "—" ? `–${formattedEndTime}` : "";
    return `${diningDate.slice(0, 10)} ${formatReservationTime(startTime)}${timeRange}`;
};
