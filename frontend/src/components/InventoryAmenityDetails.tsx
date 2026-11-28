import type { StaffAmenityState } from "../staffInventory";

export function InventoryAmenityDetails({ state }: { state: StaffAmenityState }) {
    if (state.loading) return <span role="status">Loading amenities…</span>;
    if (state.error) return <span role="alert">{state.error}</span>;
    if (state.amenities.length === 0) return <span>No amenities</span>;
    return <ul aria-label="Amenities">{state.amenities.map((amenity) => <li key={amenity.amenity_id}>{amenity.name}</li>)}</ul>;
}
