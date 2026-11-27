import assert from "node:assert/strict";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createServer } from "vite";

process.env.VITE_API_BASE_URL = "/api";
const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const componentModule = await vite.ssrLoadModule("/src/components/CustomerReservations.tsx");
test.after(async () => { await vite.close(); });

test("Customer combined reservation dining time renders without seconds", () => {
    assert.equal(typeof componentModule.CombinedDiningTime, "function");
    const markup = renderToStaticMarkup(createElement(componentModule.CombinedDiningTime, {
        startTime: "13:06:00",
        endTime: "15:08:00",
    }));
    assert.match(markup, /13:06–15:08/);
    assert.doesNotMatch(markup, /13:06:00|15:08:00/);
});

test("Customer combined reservation dining time handles missing and invalid values", () => {
    const missingStart = renderToStaticMarkup(createElement(componentModule.CombinedDiningTime, { endTime: "invalid" }));
    const invalidEnd = renderToStaticMarkup(createElement(componentModule.CombinedDiningTime, {
        startTime: "14:00:00",
        endTime: "25:00:00",
    }));

    assert.match(missingStart, /—/);
    assert.match(invalidEnd, /14:00/);
    assert.doesNotMatch(invalidEnd, /–—/);
});
