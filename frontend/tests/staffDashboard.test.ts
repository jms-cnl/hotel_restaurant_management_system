import assert from "node:assert/strict";
import test from "node:test";

const loadCards = async () => import("../src/staffDashboard.ts").catch(() => null);
const rooms = [
    { status: "Available" }, { status: "Available" }, { status: "Reserved" },
    { status: "Occupied" }, { status: "Maintenance" }, { status: "retired" },
];
const tables = [{ status: "Occupied" }, { status: "Maintenance" }];

test("room and table dashboard cards count each known status directly", async () => {
    const cards = await loadCards();
    assert.ok(cards, "the dashboard card model is available");
    const roomCard = new cards.RoomAvailabilityCard(rooms);
    const tableCard = new cards.TableAvailabilityCard(tables);

    assert.deepEqual(roomCard.getStatusCounts(), {
        Available: 2, Reserved: 1, Occupied: 1, Maintenance: 1,
    });
    assert.deepEqual(tableCard.getStatusCounts(), {
        Available: 0, Reserved: 0, Occupied: 1, Maintenance: 1,
    });
    assert.equal(roomCard.resourceName, "Rooms");
    assert.equal(tableCard.resourceName, "Tables");
});

test("dashboard cards treat unknown statuses as uncounted and empty inventory as zero", async () => {
    const cards = await loadCards();
    assert.ok(cards, "the dashboard card model is available");
    const roomCard = new cards.RoomAvailabilityCard([{ status: "unknown" }]);
    const tableCard = new cards.TableAvailabilityCard([]);

    assert.deepEqual(roomCard.getStatusCounts(), {
        Available: 0, Reserved: 0, Occupied: 0, Maintenance: 0,
    });
    assert.deepEqual(tableCard.getStatusCounts(), {
        Available: 0, Reserved: 0, Occupied: 0, Maintenance: 0,
    });
});

