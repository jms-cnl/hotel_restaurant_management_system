import { createElement, type ChangeEvent, type ReactNode } from "react";
import { isValidDateRange, isValidTimeRange } from "./customerData";
import type { RestaurantTable, Room } from "./types";

export type CombinedWizardForm = {
    roomId: string;
    checkIn: string;
    checkOut: string;
    tableId: string;
    date: string;
    startTime: string;
    endTime: string;
};

export type CombinedWizardContext = {
    form: CombinedWizardForm;
    rooms: Room[];
    tables: RestaurantTable[];
    update: (field: keyof CombinedWizardForm, value: string) => void;
};

export interface WizardStep {
    readonly id: "room" | "table" | "review";
    readonly position: 1 | 2 | 3;
    readonly title: string;
    canAdvance(form: CombinedWizardForm): boolean;
    next(): WizardStep | null;
    previous(): WizardStep | null;
    render(context: CombinedWizardContext): ReactNode;
}

abstract class WizardStepBase implements WizardStep {
    private nextStep: WizardStep | null = null;
    private previousStep: WizardStep | null = null;

    protected constructor(
        readonly id: WizardStep["id"],
        readonly position: WizardStep["position"],
        readonly title: string,
    ) {}

    connectNext(step: WizardStep) { this.nextStep = step; }
    connectPrevious(step: WizardStep) { this.previousStep = step; }
    next() { return this.nextStep; }
    previous() { return this.previousStep; }
    abstract canAdvance(form: CombinedWizardForm): boolean;
    abstract render(context: CombinedWizardContext): ReactNode;
}

const field = (label: string, input: ReactNode) => createElement("label", { className: "combined-wizard-field" }, label, input);

export class RoomStep extends WizardStepBase implements WizardStep {
    constructor() { super("room", 1, "Choose one room"); }

    canAdvance(form: CombinedWizardForm) {
        return Boolean(form.roomId) && isValidDateRange(form.checkIn, form.checkOut);
    }

    render({ form, rooms, update }: CombinedWizardContext) {
        return createElement("div", { className: "combined-wizard-fields" },
            field("Room", createElement("select", { required: true, value: form.roomId, onChange: (event: ChangeEvent<HTMLSelectElement>) => update("roomId", event.target.value) },
                createElement("option", { value: "" }, "Choose a room"),
                ...rooms.map((room) => createElement("option", { key: room.room_id, value: room.room_id }, `${room.hotel?.name ? `${room.hotel.name} · ` : ""}${room.room_type} · ₱${room.price_per_night.toLocaleString()}/night`)))),
            field("Check-in", createElement("input", { required: true, type: "date", value: form.checkIn, onChange: (event: ChangeEvent<HTMLInputElement>) => update("checkIn", event.target.value) })),
            field("Check-out", createElement("input", { required: true, type: "date", min: form.checkIn || undefined, value: form.checkOut, onChange: (event: ChangeEvent<HTMLInputElement>) => update("checkOut", event.target.value) })));
    }
}

export class TableStep extends WizardStepBase implements WizardStep {
    constructor() { super("table", 2, "Choose one restaurant table"); }

    canAdvance(form: CombinedWizardForm) {
        return Boolean(form.tableId) && Boolean(form.date) && isValidTimeRange(form.startTime, form.endTime);
    }

    render({ form, tables, update }: CombinedWizardContext) {
        return createElement("div", { className: "combined-wizard-fields" },
            field("Table", createElement("select", { required: true, value: form.tableId, onChange: (event: ChangeEvent<HTMLSelectElement>) => update("tableId", event.target.value) },
                createElement("option", { value: "" }, "Choose a table"),
                ...tables.map((table) => createElement("option", { key: table.table_id, value: table.table_id }, `${table.restaurant?.name ? `${table.restaurant.name} · ` : ""}Table ${table.table_number} · seats ${table.capacity}`)))),
            field("Dining date", createElement("input", { required: true, type: "date", value: form.date, onChange: (event: ChangeEvent<HTMLInputElement>) => update("date", event.target.value) })),
            field("Start time", createElement("input", { required: true, type: "time", value: form.startTime, onChange: (event: ChangeEvent<HTMLInputElement>) => update("startTime", event.target.value) })),
            field("End time", createElement("input", { required: true, type: "time", min: form.startTime || undefined, value: form.endTime, onChange: (event: ChangeEvent<HTMLInputElement>) => update("endTime", event.target.value) })));
    }
}

export class ReviewStep extends WizardStepBase implements WizardStep {
    constructor() { super("review", 3, "Review your stay and meal"); }

    canAdvance() { return false; }

    render({ form, rooms, tables }: CombinedWizardContext) {
        const room = rooms.find((item) => item.room_id === Number(form.roomId));
        const table = tables.find((item) => item.table_id === Number(form.tableId));
        return createElement("div", { className: "combined-wizard-review" },
            createElement("section", null, createElement("h3", null, "Hotel stay"), createElement("p", null, room ? `${room.room_type} · Room ${room.room_number}` : "Room not selected"), createElement("small", null, `${form.checkIn} – ${form.checkOut}`)),
            createElement("section", null, createElement("h3", null, "Restaurant table"), createElement("p", null, table ? `${table.restaurant?.name ? `${table.restaurant.name} · ` : ""}Table ${table.table_number}` : "Table not selected"), createElement("small", null, `${form.date} · ${form.startTime}–${form.endTime}`)));
    }
}

export const createCombinedWizardSteps = (): WizardStep => {
    const room = new RoomStep();
    const table = new TableStep();
    const review = new ReviewStep();
    room.connectNext(table);
    table.connectPrevious(room);
    table.connectNext(review);
    review.connectPrevious(table);
    return room;
};
