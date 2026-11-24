import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../migrations/20261124_single_hotel.sql", import.meta.url);
const migration = await readFile(migrationPath, "utf8").catch(() => "");

test("singleton migration requires exactly one existing hotel while holding a table lock", () => {
    assert.match(migration, /LOCK TABLE public\.hotel IN ACCESS EXCLUSIVE MODE/i);
    assert.match(migration, /SELECT COUNT\(\*\).*?INTO\s+hotel_count/is);
    assert.match(migration, /hotel_count\s*<>\s*1/i);
    assert.match(migration, /RAISE EXCEPTION/i);
});

test("singleton migration enforces at most one hotel with a unique constant index", () => {
    assert.match(migration, /CREATE UNIQUE INDEX/i);
    assert.match(migration, /ON public\.hotel\s*\(\s*\(\s*true\s*\)\s*\)/i);
});

test("database blocks hotel insert, delete, and truncate while leaving updates outside the trigger", () => {
    assert.match(migration, /BEFORE INSERT OR DELETE ON public\.hotel/i);
    assert.match(migration, /BEFORE TRUNCATE ON public\.hotel/i);
    assert.doesNotMatch(migration, /BEFORE\s+UPDATE/i);
    assert.match(migration, /RAISE EXCEPTION/i);
});
