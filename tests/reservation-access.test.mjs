import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import combinedBookingRouter from "../dist/routes/combined-booking.routes.js";
import reservationRouter from "../dist/routes/reservation.routes.js";

const getRoleGuard = (router, path, method) => router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method]
)?.route.stack[0].handle;

const checkRole = (guard, roleName) => {
    const response = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; }
    };
    let nextCalled = false;

    guard(
        { auth: { roleName, user: { id: roleName.toLowerCase() } }, body: {} },
        response,
        () => { nextCalled = true; }
    );

    return { ...response, nextCalled };
};

const creationRoutes = [
    ["reservation", reservationRouter, "/", "post"],
    ["combined booking", combinedBookingRouter, "/", "post"],
    ["hotel-and-restaurant combined booking", combinedBookingRouter, "/hotel-restaurant", "post"]
];

for (const [resource, router, path, method] of creationRoutes) {
    for (const roleName of ["Customer", "Staff", "Admin"]) {
        test(`${roleName} can create ${resource}`, () => {
            const guard = getRoleGuard(router, path, method);
            assert.equal(typeof guard, "function");

            const result = checkRole(guard, roleName);

            assert.equal(result.statusCode, 200);
            assert.equal(result.nextCalled, true);
        });
    }
}

const statusRoutes = [
    ["reservation", reservationRouter, "/:id/status", "patch"],
    ["combined booking", combinedBookingRouter, "/:id/status", "patch"]
];

for (const [resource, router, path, method] of statusRoutes) {
    for (const roleName of ["Admin", "Staff"]) {
        test(`${roleName} can change ${resource} status`, () => {
            const guard = getRoleGuard(router, path, method);
            assert.equal(typeof guard, "function");

            const result = checkRole(guard, roleName);

            assert.equal(result.statusCode, 200);
            assert.equal(result.nextCalled, true);
        });
    }

    test(`Customer cannot change ${resource} status`, () => {
        const guard = getRoleGuard(router, path, method);
        assert.equal(typeof guard, "function");

        const result = checkRole(guard, "Customer");

        assert.equal(result.statusCode, 403);
        assert.equal(result.body.message, "Insufficient permissions");
        assert.equal(result.nextCalled, false);
    });
}
