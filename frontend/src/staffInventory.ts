import { apiGet, getTableAmenities as apiGetTableAmenities } from "./api";

export type StaffAmenity = { amenity_id: number; name: string };
export type StaffAmenityState = { loading: boolean; amenities: StaffAmenity[]; error: string };
type AmenityLoaders = {
    getRoomAmenities: (path: string) => Promise<StaffAmenity[]>;
    getTableAmenities: (tableId: number) => Promise<StaffAmenity[]>;
};

export const formatStaffInventoryValue = (field: string, value: unknown) => {
    if (field === "grace_period_minutes") return value === null || value === undefined ? "—" : `${value} min`;
    return value === null || value === undefined ? "" : String(value);
};

export const staffInventoryFieldLabel = (field: string) =>
    field === "capacity" ? "No. of pax" : field === "grace_period_minutes" ? "Grace period" : field;

export const loadStaffAmenities = async (
    kind: "rooms" | "tables",
    id: number,
    loaders: AmenityLoaders = {
        getRoomAmenities: (path) => apiGet<StaffAmenity[]>(path),
        getTableAmenities: (tableId) => apiGetTableAmenities<StaffAmenity>(tableId),
    },
): Promise<StaffAmenityState> => {
    try {
        const amenities = kind === "tables"
            ? await loaders.getTableAmenities(id)
            : await loaders.getRoomAmenities(`/rooms/${id}/amenities`);
        return { loading: false, amenities, error: "" };
    } catch (error) {
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        const message = kind === "tables" && status === 403
            ? "These table amenities are only available to assigned staff."
            : "Unable to load amenities. Please try again.";
        return { loading: false, amenities: [], error: message };
    }
};
