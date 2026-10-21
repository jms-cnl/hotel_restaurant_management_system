# Polished Frontend and Backend Manual Test Checklist

Run these checks on the updated Netlify deployment with the Render API configured. Use a non-production test account and test inventory where possible.

1. **Open the site and sign in.** Confirm the StayEase customer layout loads, invalid credentials show an error, and valid sign-in opens the customer home page.
2. **Check database-backed discovery.** Browse hotels and restaurants, search by name/location, open a detail page, and confirm the displayed records, rooms, tables, and prices match the current backend data. Empty/error responses must not show sample listings.
3. **Create a hotel reservation.** Select an available room and valid dates. Confirm success, then open My Reservations and verify the new Pending reservation and dates appear.
4. **Create a restaurant reservation.** Select an available table and valid date/time. Confirm success and verify it appears under My Reservations.
5. **Check the combined booking path.** Submit a room plus table request, then confirm both reservation items and the combined booking appear with Pending status.
6. **Check manager-side CRUD and permissions.** Sign in as Staff/Admin, create or edit one test inventory record and verify the change is reflected in customer discovery. Confirm only Staff/Admin can change reservation status; customers can view but not change status.
7. **Check account flows.** Verify profile update, sign-out, and password recovery with a fresh reset email link.

Record any failing step and its visible error. Do not use a customer's real booking or alter production inventory while testing.
