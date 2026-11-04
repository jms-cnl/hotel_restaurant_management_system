export const HOTEL_STATUSES = ["Active", "Inactive", "Suspended"] as const;
export const RESTAURANT_STATUSES = HOTEL_STATUSES;
export const ROOM_STATUSES = ["Available", "Reserved", "Occupied", "Maintenance"] as const;
export const TABLE_STATUSES = ROOM_STATUSES;

export type ResourceStatus = typeof HOTEL_STATUSES[number] | typeof ROOM_STATUSES[number];

export class InvalidStatusError extends Error {
    readonly statusCode = 400;

    constructor(entity: string, allowedStatuses: readonly string[]) {
        super(`Invalid ${entity} status. Allowed values: ${allowedStatuses.join(", ")}.`);
        this.name = "InvalidStatusError";
    }
}

export const canonicalizeStatus = (
    value: unknown,
    entity: string,
    allowedStatuses: readonly string[],
    defaultStatus: string
): string => {
    if (value === undefined) return defaultStatus;

    if (typeof value === "string") {
        const normalized = value.trim().toLocaleLowerCase();
        const canonical = allowedStatuses.find((status) => status.toLocaleLowerCase() === normalized);
        if (canonical) return canonical;
    }

    throw new InvalidStatusError(entity, allowedStatuses);
};
