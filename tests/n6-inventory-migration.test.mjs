import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../migrations/20261128_n6_inventory_details.sql", import.meta.url);
const migration = await readFile(migrationPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
});

test("N6 adds defaulted grace period columns with resource-specific limits", () => {
    assert.match(migration, /alter\s+table\s+public\.room[\s\S]*?add\s+column\s+if\s+not\s+exists\s+grace_period_minutes\s+integer\s+not\s+null\s+default\s+30/i);
    assert.match(migration, /update\s+public\.room\s+set\s+grace_period_minutes\s*=\s*30\s+where\s+grace_period_minutes\s+is\s+null/i);
    assert.match(migration, /room_grace_period_minutes_check[\s\S]{0,160}check\s*\(\s*grace_period_minutes\s+between\s+0\s+and\s+1440\s*\)/i);
    assert.match(migration, /alter\s+table\s+public\.restaurant_table[\s\S]*?add\s+column\s+if\s+not\s+exists\s+grace_period_minutes\s+integer\s+not\s+null\s+default\s+30/i);
    assert.match(migration, /update\s+public\.restaurant_table\s+set\s+grace_period_minutes\s*=\s*30\s+where\s+grace_period_minutes\s+is\s+null/i);
    assert.match(migration, /restaurant_table_grace_period_minutes_check[\s\S]{0,160}check\s*\(\s*grace_period_minutes\s+between\s+0\s+and\s+30\s*\)/i);
});

test("N6 protects capacity and grace changes while allowing trusted database roles", () => {
    assert.match(migration, /create\s+or\s+replace\s+function\s+public\.protect_room_table_capacity_grace\s*\(\s*\)[\s\S]*?returns\s+trigger/i);
    assert.match(migration, /current_user\s+in\s*\(\s*'service_role'\s*,\s*'postgres'\s*,\s*'supabase_admin'\s*\)\s+or\s+public\.is_admin\s*\(\s*\)/i);
    assert.match(migration, /new\.capacity\s+is\s+distinct\s+from\s+old\.capacity/i);
    assert.match(migration, /new\.grace_period_minutes\s+is\s+distinct\s+from\s+old\.grace_period_minutes/i);
    assert.match(migration, /raise\s+exception[\s\S]{0,100}errcode\s*=\s*'42501'/i);
    assert.match(migration, /create\s+trigger\s+room_protect_capacity_grace[\s\S]{0,160}before\s+update\s+on\s+public\.room/i);
    assert.match(migration, /create\s+trigger\s+restaurant_table_protect_capacity_grace[\s\S]{0,200}before\s+update\s+on\s+public\.restaurant_table/i);
});

test("N6 creates table amenity links with cascading keys and an amenity lookup index", () => {
    assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.table_amenity\s*\([\s\S]*?table_id\s+bigint\s+not\s+null\s+references\s+public\.restaurant_table\s*\(\s*table_id\s*\)\s+on\s+delete\s+cascade/i);
    assert.match(migration, /amenity_id\s+bigint\s+not\s+null\s+references\s+public\.amenity\s*\(\s*amenity_id\s*\)\s+on\s+delete\s+cascade/i);
    assert.match(migration, /primary\s+key\s*\(\s*table_id\s*,\s*amenity_id\s*\)/i);
    assert.match(migration, /create\s+index\s+if\s+not\s+exists\s+table_amenity_amenity_id_idx\s+on\s+public\.table_amenity\s*\(\s*amenity_id\s*\)/i);
});

test("N6 enables table amenity RLS with Admin writes and Staff/Admin reads only", () => {
    assert.match(migration, /alter\s+table\s+public\.table_amenity\s+enable\s+row\s+level\s+security/i);
    assert.match(migration, /create\s+policy\s+"Admins can manage table amenities"\s+on\s+public\.table_amenity\s+for\s+all\s+to\s+authenticated\s+using\s*\(\s*public\.is_admin\s*\(\s*\)\s*\)\s+with\s+check\s*\(\s*public\.is_admin\s*\(\s*\)\s*\)/i);
    assert.match(migration, /create\s+policy\s+"Staff and admins can view table amenities"\s+on\s+public\.table_amenity\s+for\s+select\s+to\s+authenticated\s+using\s*\(\s*public\.is_staff_or_admin\s*\(\s*\)\s*\)/i);
    assert.match(migration, /revoke\s+all\s+on\s+public\.table_amenity\s+from\s+anon/i);
    assert.match(migration, /grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+public\.table_amenity\s+to\s+authenticated/i);
    assert.doesNotMatch(migration, /create\s+policy[^;]*\bto\s+anon\b/i);
});
