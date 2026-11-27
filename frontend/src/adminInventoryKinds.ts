import { defaultStatusFor, statusOptionsFor, type InventoryResourceKind as ResourceKindName } from "./types";

export type FieldType = "text" | "number" | "email" | "select";
export type InventoryFieldDefinition = {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    min?: number;
    options?: string[];
};
export type InventoryRecord = Record<string, unknown>;
export type InventoryModalMode = "create" | "edit" | "view";

type AmenitySettings = {
    parentField: string;
    label: string;
    subject: string;
    showOnCreate: boolean;
    showOnEdit: boolean;
    requireLoadedOnCreate: boolean;
    requireLoadedOnEdit: boolean;
    initiallyLoaded: boolean;
};

export interface InventoryResourceKind {
    readonly kind: string;
    readonly label: string;
    readonly singular: string;
    readonly description: string;
    readonly endpoint: string;
    readonly idField: string;
    readonly statusField?: string;
    readonly fields: readonly InventoryFieldDefinition[];
    readonly columns: readonly InventoryFieldDefinition[];
    readonly statusOptions: readonly string[];
    readonly defaultStatus: string;
    readonly summaryStatus: string;
    readonly mediaEntityType: "hotel" | "restaurant" | "room" | "table";
    readonly supportsAmenities: boolean;
    readonly amenityParentField?: string;
    readonly amenitiesLabel?: string;
    readonly amenitySubject?: string;
    readonly initialAmenitiesLoaded: boolean;
    getAmenityHotelId(mode: InventoryModalMode, formValues: Record<string, string>, record?: InventoryRecord): string;
    getAmenitiesPath(record: InventoryRecord): string;
    shouldShowAmenitiesForm(mode: InventoryModalMode): boolean;
    shouldRequireAmenitiesLoaded(mode: InventoryModalMode): boolean;
}

type InventoryResourceConfig = Omit<InventoryResourceKind,
    "columns" | "statusOptions" | "defaultStatus" | "supportsAmenities" | "amenityParentField" |
    "amenitiesLabel" | "amenitySubject" | "initialAmenitiesLoaded" | "getAmenityHotelId" |
    "getAmenitiesPath" | "shouldShowAmenitiesForm" | "shouldRequireAmenitiesLoaded"> & {
        amenities?: AmenitySettings;
    };

const asText = (value: unknown) => value === null || value === undefined ? "" : String(value);

export const createInventoryResourceKind = (config: InventoryResourceConfig): InventoryResourceKind => {
    const amenities = config.amenities;
    return {
        ...config,
        columns: config.fields,
        statusOptions: [...statusOptionsFor(config.kind as ResourceKindName)],
        defaultStatus: defaultStatusFor(config.kind as ResourceKindName),
        supportsAmenities: Boolean(amenities),
        amenityParentField: amenities?.parentField,
        amenitiesLabel: amenities?.label,
        amenitySubject: amenities?.subject,
        initialAmenitiesLoaded: amenities?.initiallyLoaded ?? false,
        getAmenityHotelId(mode, formValues, record) {
            if (!amenities) return "";
            return mode === "create" ? asText(formValues[amenities.parentField]) : asText(record?.[amenities.parentField]);
        },
        getAmenitiesPath(record) {
            return `${config.endpoint}/${record[config.idField]}/amenities`;
        },
        shouldShowAmenitiesForm(mode) {
            return mode === "create" ? amenities?.showOnCreate ?? false : mode === "edit" && (amenities?.showOnEdit ?? false);
        },
        shouldRequireAmenitiesLoaded(mode) {
            return mode === "create" ? amenities?.requireLoadedOnCreate ?? false : mode === "edit" && (amenities?.requireLoadedOnEdit ?? false);
        },
    };
};

export const hotelInventoryKind = createInventoryResourceKind({
    kind: "hotels", label: "Hotels", singular: "Hotel", description: "Manage hotel information and availability.",
    endpoint: "/hotels", idField: "hotel_id", statusField: "status", summaryStatus: "Active", mediaEntityType: "hotel",
    fields: [
        { key: "name", label: "Hotel Name", type: "text", required: true },
        { key: "address", label: "Address", type: "text", required: true },
        { key: "description", label: "Description", type: "text" },
        { key: "contact_number", label: "Contact Number", type: "text", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "status", label: "Status", type: "select", required: true, options: [...statusOptionsFor("hotels")] },
    ],
});

export const restaurantInventoryKind = createInventoryResourceKind({
    kind: "restaurants", label: "Restaurants", singular: "Restaurant", description: "Manage restaurant information and availability.",
    endpoint: "/restaurants", idField: "restaurant_id", statusField: "status", summaryStatus: "Active", mediaEntityType: "restaurant",
    amenities: { parentField: "hotel_id", label: "Restaurant Amenities", subject: "restaurant", showOnCreate: false, showOnEdit: true, requireLoadedOnCreate: false, requireLoadedOnEdit: true, initiallyLoaded: false },
    fields: [
        { key: "name", label: "Restaurant Name", type: "text", required: true },
        { key: "address", label: "Address", type: "text", required: true },
        { key: "description", label: "Description", type: "text" },
        { key: "contact_number", label: "Contact Number", type: "text", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "status", label: "Status", type: "select", required: true, options: [...statusOptionsFor("restaurants")] },
    ],
});

export const roomInventoryKind = createInventoryResourceKind({
    kind: "rooms", label: "Rooms", singular: "Room", description: "Manage room information, capacity, pricing, and availability.",
    endpoint: "/rooms", idField: "room_id", statusField: "status", summaryStatus: "Available", mediaEntityType: "room",
    amenities: { parentField: "hotel_id", label: "Room Amenities", subject: "room", showOnCreate: true, showOnEdit: true, requireLoadedOnCreate: true, requireLoadedOnEdit: true, initiallyLoaded: true },
    fields: [
        { key: "hotel_id", label: "Hotel ID", type: "number", required: true, min: 1 },
        { key: "room_number", label: "Room Number", type: "text", required: true },
        { key: "room_type", label: "Room Type", type: "select", required: true, options: ["Standard Room", "Deluxe Room", "Family Room", "Suite"] },
        { key: "capacity", label: "Capacity", type: "number", required: true, min: 1 },
        { key: "price_per_night", label: "Price per Night (₱)", type: "number", required: true, min: 0 },
        { key: "status", label: "Room Status", type: "select", required: true, options: [...statusOptionsFor("rooms")] },
    ],
});

export const tableInventoryKind = createInventoryResourceKind({
    kind: "tables", label: "Tables", singular: "Table", description: "Manage restaurant tables, seating capacity, and availability.",
    endpoint: "/tables", idField: "table_id", statusField: "status", summaryStatus: "Available", mediaEntityType: "table",
    fields: [
        { key: "restaurant_id", label: "Restaurant ID", type: "number", required: true, min: 1 },
        { key: "table_number", label: "Table Number", type: "text", required: true },
        { key: "capacity", label: "Seating Capacity", type: "number", required: true, min: 1 },
        { key: "status", label: "Table Status", type: "select", required: true, options: [...statusOptionsFor("tables")] },
    ],
});

export const createInventoryResourceRegistry = (kinds: readonly InventoryResourceKind[]) =>
    new Map(kinds.map((kind) => [kind.kind, kind]));

export const inventoryResourceKinds = createInventoryResourceRegistry([
    hotelInventoryKind,
    restaurantInventoryKind,
    roomInventoryKind,
    tableInventoryKind,
]);

export const getInventoryResourceKind = (kind: string) => inventoryResourceKinds.get(kind);
