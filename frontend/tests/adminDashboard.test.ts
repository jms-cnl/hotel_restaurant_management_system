import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Admin dashboard omits the Recent Operations placeholder", async () => {
    const adminPages = await readFile(new URL("../src/components/AdminPages.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(adminPages, /Recent Operations|No recent operations available|operations activity feed/i);
});
