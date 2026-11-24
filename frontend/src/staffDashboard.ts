const inventoryStatuses = ["Available", "Reserved", "Occupied", "Maintenance"] as const;
type InventoryItem = { status: string };

export type AvailabilityCounts = Record<typeof inventoryStatuses[number], number>;

export interface AvailabilityCard {
    readonly resourceName: string;
    getStatusCounts(): AvailabilityCounts;
}

abstract class InventoryAvailabilityCard implements AvailabilityCard {
    abstract readonly resourceName: string;
    private readonly inventory: readonly InventoryItem[];

    protected constructor(inventory: readonly InventoryItem[]) {
        this.inventory = inventory;
    }

    getStatusCounts(): AvailabilityCounts {
        return Object.fromEntries(inventoryStatuses.map((status) => [
            status,
            this.inventory.filter((item) => item.status.trim().toLocaleLowerCase() === status.toLocaleLowerCase()).length,
        ])) as AvailabilityCounts;
    }
}

export class RoomAvailabilityCard extends InventoryAvailabilityCard {
    readonly resourceName = "Rooms";

    constructor(rooms: readonly InventoryItem[]) {
        super(rooms);
    }
}

export class TableAvailabilityCard extends InventoryAvailabilityCard {
    readonly resourceName = "Tables";

    constructor(tables: readonly InventoryItem[]) {
        super(tables);
    }
}
