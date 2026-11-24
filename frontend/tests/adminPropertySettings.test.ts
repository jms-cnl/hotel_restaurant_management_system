import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PropertySettingsTab } from "../src/adminTabs.ts";

test("Property Settings tab keeps the existing Hotels route", () => {
    const tab = new PropertySettingsTab();
    assert.equal(tab.label, "Property settings");
    assert.equal(tab.path, "/hotels");
});

test("Property settings page edits the existing hotel and exposes no create or delete actions", async () => {
    const form = await readFile(new URL("../src/components/PropertySettingsForm.tsx", import.meta.url), "utf8").catch(() => "");
    const page = await readFile(new URL("../src/components/AdminPropertySettingsPage.tsx", import.meta.url), "utf8").catch(() => "");
    assert.match(form, /Property settings/);
    assert.match(form, /Save changes/);
    assert.match(form, /name="name"/);
    assert.match(form, /name="address"/);
    assert.match(page, /apiPut<Hotel>/);
    assert.doesNotMatch(`${form}\n${page}`, /apiPost|apiDelete|Add hotel|Create hotel|Delete hotel/i);
});
