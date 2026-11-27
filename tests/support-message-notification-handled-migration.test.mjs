import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "../supabase/migrations/20261127_n1_support_notification_handled.sql";
const migration = await readFile(new URL(migrationPath, import.meta.url), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
});

test("handled timestamp migration adds a nullable notification column and scoped update grant", () => {
    assert.match(migration, /alter\s+table\s+public\.support_message_admin_notification\s+add\s+column\s+handled_at\s+timestamptz\s*;/i);
    assert.doesNotMatch(migration, /handled_at\s+timestamptz\s+(?:not\s+null|default\s+now\s*\()/i);
    assert.match(migration, /grant\s+update\s*\(\s*handled_at\s*\)\s+on\s+public\.support_message_admin_notification\s+to\s+authenticated\s*;/i);
    assert.equal((migration.match(/\bgrant\b/gi) ?? []).length, 1);
    assert.doesNotMatch(migration, /service_role/i);
});

test("only Admins can update notification handled_at", () => {
    const policy = migration.match(/create\s+policy\s+support_message_admin_notification_handled_update[\s\S]*?;/i)?.[0] ?? "";
    assert.match(policy, /on\s+public\.support_message_admin_notification/i);
    assert.match(policy, /for\s+update\s+to\s+authenticated/i);
    assert.match(policy, /using\s*\([\s\S]*?auth\.uid\(\)[\s\S]*?role_name\s*=\s*'Admin'[\s\S]*?\)/i);
    assert.match(policy, /with\s+check\s*\([\s\S]*?auth\.uid\(\)[\s\S]*?role_name\s*=\s*'Admin'[\s\S]*?\)/i);
    assert.doesNotMatch(policy, /admin_user_id\s*=\s*auth\.uid\(\)/i);
    assert.doesNotMatch(policy, /role_name\s*=\s*'(?:Customer|Staff)'/i);
});

test("all Admins can select notification rows", () => {
    assert.match(migration, /drop\s+policy\s+support_message_admin_notification_recipient_select\s+on\s+public\.support_message_admin_notification/i);
    const policy = migration.match(/create\s+policy\s+support_message_admin_notification_recipient_select[\s\S]*?;/i)?.[0] ?? "";
    assert.match(policy, /on\s+public\.support_message_admin_notification/i);
    assert.match(policy, /for\s+select\s+to\s+authenticated/i);
    assert.match(policy, /using\s*\([\s\S]*?auth\.uid\(\)[\s\S]*?role_name\s*=\s*'Admin'[\s\S]*?\)/i);
    assert.doesNotMatch(policy, /admin_user_id\s*=\s*auth\.uid\(\)/i);
});

test("handled timestamp migration does not alter notification triggers", () => {
    assert.doesNotMatch(migration, /create\s+trigger|drop\s+trigger|create\s+function|drop\s+function/i);
});
