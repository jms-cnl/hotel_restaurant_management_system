import assert from "node:assert/strict";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const wizard = await vite.ssrLoadModule("/src/components/CombinedStayWizard.tsx");
test.after(async () => { await vite.close(); });

const completeForm = {
    room_id: "12",
    check_in_date: "2026-12-01",
    check_out_date: "2026-12-03",
    table_id: "5",
    reservation_date: "2026-12-02",
    start_time: "18:00",
    end_time: "19:00",
};

test("wizard gates progress on required room and table selections", () => {
    assert.equal(wizard.getWizardStepError(1, { ...completeForm, room_id: "" }), "Choose a room and enter check-in and check-out dates.");
    assert.equal(wizard.getWizardStepError(2, { ...completeForm, table_id: "" }), "Choose a table and enter the dining date, start time, and end time.");
    assert.equal(wizard.getWizardStepError(1, completeForm), "");
    assert.equal(wizard.getWizardStepError(2, completeForm), "");
});

test("wizard preserves its current check-out and time range behavior", () => {
    assert.equal(wizard.getWizardStepError(1, { ...completeForm, check_out_date: "2026-11-30" }), "");
    assert.equal(wizard.getWizardStepError(2, { ...completeForm, end_time: "17:59" }), "");
});

test("review displays the selected room and table", () => {
    const markup = renderToStaticMarkup(createElement(wizard.CombinedStayReview, {
        hotelName: "Harbor Hotel",
        roomType: "Deluxe",
        roomNumber: "12",
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        pricePerNight: 5000,
        restaurantName: "Garden Bistro",
        tableNumber: "5",
        diningDate: "2026-12-02",
        startTime: "18:00",
        endTime: "19:00",
    }));

    assert.match(markup, /Harbor Hotel/);
    assert.match(markup, /Deluxe · Room 12/);
    assert.match(markup, /Garden Bistro/);
    assert.match(markup, /Table 5/);
});
