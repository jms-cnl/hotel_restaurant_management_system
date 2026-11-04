import assert from "node:assert/strict";
import test from "node:test";
import { canChangeUserRole, confirmRoleChange, staffUsers, type AdminManagementUser } from "../src/adminManagement.ts";

const users: AdminManagementUser[] = [
    { user_id: "admin-id", first_name: "Ada", last_name: "Admin", email: "ada@example.com", role: "Admin" },
    { user_id: "staff-id", first_name: "Sam", last_name: "Staff", email: "sam@example.com", role: "Staff" },
    { user_id: "customer-id", first_name: "Casey", last_name: "Customer", email: "casey@example.com", role: "Customer" },
];

test("role controls are read-only for Admin rows and the signed-in user's row", () => {
    assert.equal(canChangeUserRole("admin-id", "current-id", "Admin"), false);
    assert.equal(canChangeUserRole("current-id", "current-id", "Staff"), false);
    assert.equal(canChangeUserRole("staff-id", "current-id", "Staff"), true);
});

test("staff assignment picker includes Staff users only", () => {
    assert.deepEqual(staffUsers(users).map((user) => user.user_id), ["staff-id"]);
});

test("demotion confirmation can cancel Staff-to-Customer changes", () => {
    let prompt = "";
    const approved = confirmRoleChange("Staff", "Customer", (message) => {
        prompt = message;
        return false;
    });
    assert.equal(prompt, "Demote to Customer? Their restaurant assignments will be removed.");
    assert.equal(approved, false);
});

test("other role changes do not require demotion confirmation", () => {
    let prompted = false;
    const approved = confirmRoleChange("Customer", "Staff", () => {
        prompted = true;
        return false;
    });
    assert.equal(prompted, false);
    assert.equal(approved, true);
});
