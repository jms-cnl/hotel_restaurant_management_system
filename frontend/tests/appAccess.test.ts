import assert from "node:assert/strict";
import test from "node:test";
import { canCreateReservations, isAdmin, isManager, landingPath, role, userName } from "../src/appAccess.ts";
import type { User } from "../src/types.ts";

const user = (roleName: string, overrides: Partial<User> = {}): User => ({
    user_id: "user-1",
    role_id: 1,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.test",
    role: { role_name: roleName },
    ...overrides,
});

test("role defaults missing and null users to Customer", () => {
    assert.equal(role(null), "Customer");
    assert.equal(role(user("Customer", { role: null })), "Customer");
    assert.equal(role(user("Staff")), "Staff");
});

test("Staff and Admin are managers while only Admin is an administrator", () => {
    assert.equal(isManager(user("Staff")), true);
    assert.equal(isManager(user("Admin")), true);
    assert.equal(isManager(user("Customer")), false);
    assert.equal(isManager(null), false);
    assert.equal(isAdmin(user("Admin")), true);
    assert.equal(isAdmin(user("Staff")), false);
    assert.equal(isAdmin(null), false);
});

test("landing destination follows customer and manager roles", () => {
    assert.equal(landingPath(user("Customer")), "/home");
    assert.equal(landingPath(user("Staff")), "/dashboard");
    assert.equal(landingPath(user("Admin")), "/dashboard");
    assert.equal(landingPath(null), "/home");
});

test("reservation creation is permitted for customer, staff, and admin users", () => {
    assert.equal(canCreateReservations(user("Customer")), true);
    assert.equal(canCreateReservations(user("Staff")), true);
    assert.equal(canCreateReservations(user("Admin")), true);
    assert.equal(canCreateReservations(null), true);
    assert.equal(canCreateReservations(user("Other")), false);
});

test("user name uses full name, then email, then the staff fallback", () => {
    assert.equal(userName(user("Staff")), "Ada Lovelace");
    assert.equal(userName(user("Staff", { first_name: "", last_name: "" })), "ada@example.test");
    assert.equal(userName(null), "Staff Member");
});
