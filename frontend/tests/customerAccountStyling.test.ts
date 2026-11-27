import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("login retains accessible labels, autocomplete, alert, and submit behavior", async () => {
    const app = await source("../src/App.tsx");
    const authPage = app.slice(app.indexOf("function AuthPage"), app.indexOf("function Dashboard"));

    assert.match(authPage, /className=\{registerMode \? "auth-page" : "auth-page customer-auth-page"\}/);
    assert.match(authPage, /<label>Email address<input type="email" autoComplete="email" required/);
    assert.match(authPage, /<label>Password<input type="password" autoComplete=\{registerMode \? "new-password" : "current-password"\} required/);
    assert.match(authPage, /className="alert error" role="alert"/);
    assert.match(authPage, /className="auth-button" type="submit"/);
});

test("Customer notifications expose read state, date, active navigation, and existing actions", async () => {
    const [app, layout, css] = await Promise.all([
        source("../src/App.tsx"),
        source("../src/components/CustomerLayout.tsx"),
        source("../src/customer-theme.css"),
    ]);
    const customerNotifications = app.slice(app.indexOf("function CustomerNotifications"), app.indexOf("function Users"));

    assert.match(customerNotifications, /customer-notifications-page/);
    assert.match(customerNotifications, /customer-notification-card/);
    assert.match(customerNotifications, /is_read/);
    assert.match(customerNotifications, /created_at/);
    assert.match(customerNotifications, /Mark as read/);
    assert.match(customerNotifications, /`\/notifications\/\$\{id\}\/read`/);
    assert.match(layout, /className=\{\(\{ isActive \}\) => `notification-link\$\{isActive \? " active" : ""\}`\}/);
    assert.match(css, /\.customer-notification-card\.is-read/);
    assert.match(css, /\.customer-notification-card\.is-unread/);
    assert.match(css, /\.customer-auth-page/);
    assert.match(css, /@media \(max-width: (?:600|650|700)px\)[\s\S]*customer-notifications-page/);
    assert.match(app, /if \(isAdmin\(user\)\) return <AdminNotifications \/>;/);
    assert.match(app, /return isManager\(user\) \? <ManagerNotifications \/> : <CustomerNotifications \/>;/);
    assert.match(app, /function ManagerNotifications\(\)[\s\S]*apiGet<Record<string, unknown>\[]>\("\/notifications"\)/);
});
