import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Customer password changes keep wrong-current-password feedback on the password tab", async () => {
    const [app, api, auth] = await Promise.all([
        source("../src/App.tsx"),
        source("../src/api.ts"),
        source("../src/auth.tsx"),
    ]);
    const managerStart = app.indexOf("if (manager) return <main className=\"customer-profile-page\">");
    const customerStart = app.indexOf("return <main className=\"customer-profile-page\">", app.indexOf("</main>;", managerStart));
    const customerProfile = app.slice(customerStart);
    const passwordTabStart = customerProfile.indexOf('{activeTab === "password" &&');
    const passwordTab = customerProfile.slice(passwordTabStart, customerProfile.indexOf("</section>}", passwordTabStart));

    assert.match(api, /if \(response\.status === 401\)[\s\S]*notify\("hrms:session-expired"\)/);
    assert.match(auth, /const onExpired = \(\) => expireLocalSession\(\)/);
    assert.match(customerProfile, /onSubmit=\{changeCustomerPassword\}/);
    assert.match(passwordTab, /role="alert"/);
    assert.match(passwordTab, /role="status"/);
    assert.match(app, /"\/auth\/change-password"/);
    assert.match(app, /current_password: passwordForm\.current, new_password: passwordForm\.next/);
    assert.match(app, /credentials: "include"[\s\S]*"X-CSRF-Token": csrfToken/);
    assert.match(app, /response\.status === 401 && responseMessage !== "Current password is incorrect"/);
    assert.match(app, /if \(manager\) return <main className="customer-profile-page">[\s\S]*onSubmit=\{changePassword\}/);
});
