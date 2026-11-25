import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");

test("combined wizard uses an interface and polymorphic step classes", async () => {
    const [steps, page] = await Promise.all([
        source("../src/combinedWizardSteps.ts"),
        source("../src/components/CustomerCombinedBookings.tsx"),
    ]);

    assert.match(steps, /export interface WizardStep/);
    assert.match(steps, /export class RoomStep extends WizardStepBase implements WizardStep/);
    assert.match(steps, /export class TableStep extends WizardStepBase implements WizardStep/);
    assert.match(steps, /export class ReviewStep extends WizardStepBase implements WizardStep/);
    assert.match(page, /createCombinedWizardSteps/);
    assert.match(page, /activeStep\.render\(/);
    assert.match(page, /activeStep\.canAdvance\(/);
    assert.doesNotMatch(steps, /(?:wizardSteps|const steps)\s*=\s*\[/);
});

test("room and table selections gate progress before the review submission", async () => {
    const steps = await source("../src/combinedWizardSteps.ts");
    const page = await source("../src/components/CustomerCombinedBookings.tsx");

    assert.match(steps, /Boolean\(form\.roomId\)/);
    assert.match(steps, /Boolean\(form\.tableId\)/);
    assert.match(page, /activeStep\.id === "review"/);
    assert.match(page, /\/combined-bookings\/hotel-restaurant/);
    assert.match(page, /buildCombinedBookingPayload/);
});

test("wizard retains success and error feedback and combined cards gain spacing", async () => {
    const [page, css] = await Promise.all([
        source("../src/components/CustomerCombinedBookings.tsx"),
        source("../src/customer-theme.css"),
    ]);

    assert.match(page, /Combined booking request sent\./);
    assert.match(page, /Unable to create combined booking/);
    assert.match(page, /combined-booking-child/);
    assert.match(css, /\.combined-booking-child\s*\{/);
    assert.match(css, /\.combined-wizard-progress\s*\{/);
});

test("available room count uses singular wording for one room type", async () => {
    const page = await source("../src/components/HotelDetails.tsx");

    assert.match(page, /availableRoomTypes === 1 \? "room type" : "room types"/);
});
