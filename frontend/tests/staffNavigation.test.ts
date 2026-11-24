import assert from "node:assert/strict";
import test from "node:test";

const loadStaffNavigation = async () => import("../src/staffNavigation.ts").catch(() => null);

test("Staff navigation exposes room and table inventory without property pages", async () => {
    const navigation = await loadStaffNavigation();
    assert.ok(navigation, "the Staff navigation model is available");
    const paths = navigation.staffNavigationItems.map((item) => item.to);

    assert.deepEqual(paths, ["/dashboard", "/rooms", "/tables", "/reservations", "/manage"]);
    assert.equal(paths.includes("/hotels"), false);
    assert.equal(paths.includes("/restaurants"), false);
    assert.deepEqual(navigation.staffAccountLinks.map((item) => item.to), ["/notifications", "/profile"]);
});

test("Staff property routes redirect to Dashboard while unrelated routes remain unchanged", async () => {
    const navigation = await loadStaffNavigation();
    assert.ok(navigation, "the Staff route policy is available");
    for (const path of [
        "/properties",
        "/hotels",
        "/restaurants",
        "/hotels/8",
        "/restaurants/3",
    ]) {
        assert.equal(navigation.staffRedirectForPath(path), "/dashboard", `${path} redirects to Dashboard`);
    }

    for (const path of ["/dashboard", "/rooms", "/tables", "/reservations", "/manage"]) {
        assert.equal(navigation.staffRedirectForPath(path), null, `${path} remains available to Staff`);
    }
});
