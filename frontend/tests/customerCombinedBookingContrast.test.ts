import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("combined booking rows set readable text against their navy background", async () => {
    const css = await source("../src/customer-theme.css");
    const rowRule = css.match(/\.combined-booking-child\s*\{([^}]*)\}/s)?.[1] ?? "";

    assert.match(rowRule, /background:\s*#17243a/);
    assert.match(rowRule, /color:\s*#f5f5f5/);
});

test("combined booking reservation status uses the existing status pill styles", async () => {
    const component = await source("../src/components/CustomerCombinedBookings.tsx");

    assert.match(component, /className=\{`reservation-status \$\{reservation\.status\.toLowerCase\(\)\}`\}>\{reservation\.status\}/);
});
