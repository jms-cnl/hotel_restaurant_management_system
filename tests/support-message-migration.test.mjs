import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "../migrations/20261127_n1_support_inbox.sql";
const migration = await readFile(new URL(migrationPath, import.meta.url), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
});

test("N1 migration defines support messages, history, and Admin inbox notifications", () => {
    assert.match(migration, /create\s+table\s+public\.support_message\b/i);
    assert.match(migration, /customer_id\s+uuid[\s\S]{0,120}references\s+public\."user"\s*\(user_id\)/i);
    assert.match(migration, /subject\s+varchar\s*\(\s*120\s*\)/i);
    assert.match(migration, /char_length\s*\(\s*btrim\s*\(\s*message\s*\)\s*\)[\s\S]{0,80}5000/i);
    assert.match(migration, /status[\s\S]{0,100}open[\s\S]{0,80}resolved/i);
    assert.match(migration, /create\s+table\s+public\.support_message_history\b/i);
    assert.match(migration, /create\s+table\s+public\.support_message_admin_notification\b/i);
    assert.match(migration, /(?:unique\s*\(\s*support_message_id\s*,\s*admin_user_id\s*\)|primary\s+key\s*\(\s*support_message_id\s*,\s*admin_user_id\s*\))/i);
    assert.match(migration, /create\s+index[\s\S]{0,180}support_message/i);
});

test("support tables use scoped RLS and the notification trigger is narrowly secured", () => {
    assert.match(migration, /alter\s+table\s+public\.support_message\s+enable\s+row\s+level\s+security/i);
    assert.match(migration, /alter\s+table\s+public\.support_message_history\s+enable\s+row\s+level\s+security/i);
    assert.match(migration, /alter\s+table\s+public\.support_message_admin_notification\s+enable\s+row\s+level\s+security/i);
    assert.match(migration, /create\s+policy[\s\S]{0,900}support_message/i);
    assert.match(migration, /auth\.uid\(\)/i);
    assert.match(migration, /security\s+definer/i);
    assert.match(migration, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public/i);
    assert.match(migration, /revoke\s+all\s+on\s+function[\s\S]{0,180}from\s+public/i);
    assert.match(migration, /create\s+trigger[\s\S]{0,250}support_message_admin_notification/i);
    assert.doesNotMatch(migration, /service_role/i);
});

