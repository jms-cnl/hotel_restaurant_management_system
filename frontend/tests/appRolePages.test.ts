import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isValidElement } from "react";
import { createServer } from "vite";
import type { User } from "../src/types.ts";

const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const rolePages = await vite.ssrLoadModule("/src/components/AppRolePages.tsx");
const adminPages = await vite.ssrLoadModule("/src/components/AdminPages.tsx");
const staffPages = await vite.ssrLoadModule("/src/components/StaffDashboardPage.tsx");
const customerPages = await vite.ssrLoadModule("/src/components/CustomerHome.tsx");
test.after(async () => { await vite.close(); });

const user = (roleName: string): User => ({
    user_id: `user-${roleName.toLowerCase()}`,
    role_id: 1,
    first_name: "Test",
    last_name: "User",
    email: "test@example.test",
    role: { role_name: roleName },
});

test("Dashboard selects Admin dashboard for Admin and Staff dashboard for Staff", () => {
    const adminDashboard = rolePages.dashboardForUser(user("Admin"));
    const staffDashboard = rolePages.dashboardForUser(user("Staff"));

    assert.equal(isValidElement(adminDashboard), true);
    assert.equal(adminDashboard.type, adminPages.AdminDashboard);
    assert.equal(isValidElement(staffDashboard), true);
    assert.equal(staffDashboard.type, staffPages.StaffDashboardPage);
    assert.equal(staffDashboard.props.user.role?.role_name, "Staff");
});

test("Home shows the Customer home and redirects manager roles to Dashboard", () => {
    const customerHome = rolePages.homeForUser(user("Customer"));
    const staffHome = rolePages.homeForUser(user("Staff"));
    const adminHome = rolePages.homeForUser(user("Admin"));

    assert.equal(isValidElement(customerHome), true);
    assert.equal(customerHome.type, customerPages.CustomerHome);
    assert.equal(isValidElement(staffHome), true);
    assert.equal(staffHome.props.to, "/dashboard");
    assert.equal(staffHome.props.replace, true);
    assert.equal(isValidElement(adminHome), true);
    assert.equal(adminHome.props.to, "/dashboard");
    assert.equal(adminHome.props.replace, true);
});

test("Landing redirect follows each role's existing landing destination", () => {
    for (const [roleName, destination] of [["Customer", "/home"], ["Staff", "/dashboard"], ["Admin", "/dashboard"]]) {
        const redirect = rolePages.landingRedirectForUser(user(roleName));
        assert.equal(isValidElement(redirect), true);
        assert.equal(redirect.props.to, destination);
        assert.equal(redirect.props.replace, true);
    }
});

test("Staff inventory routes stay on the read-only ResourcePage while Admin gets edit controls", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
    assert.match(app, /function ManagerInventoryRoute[\s\S]*?return isAdmin\(user\) \? <AdminInventoryPage kind=\{kind\} \/> : <ResourcePage kind=\{kind\} \/>/);
    assert.match(app, /function ResourcePage[\s\S]*?\{manager && <form className="form-panel inline-form"/);
});
