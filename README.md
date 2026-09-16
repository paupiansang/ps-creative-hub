# PS Creative Hub V7 — KBZ Pay Premium Build

Clean V7 marketplace build with responsive UI and manual KBZ Pay Premium membership.

## Start
1. Extract this ZIP to your V7 project folder.
2. Run `START.bat`.
3. Keep the black server window open.
4. Open `http://localhost:3000`.

## Premium payment flow
- Premium membership uses **KBZ Pay only**.
- Account name: **PaugPyinSang**
- KBZ Pay number: **0897185588**
- 1 month: **10,000 MMK**
- 2–6 months: 20,000–60,000 MMK (10,000 MMK/month).
- Customer chooses a plan, transfers the exact amount, enters Transaction ID, and uploads the payment screenshot.
- Admin opens `/admin.html`, checks the proof, then clicks **Approve** or **Reject**.
- Approval activates Premium access for all premium products for the selected duration.
- If a customer already has active Premium, a newly approved payment extends the existing expiry date.

## Admin
The first run creates the admin account from `.env`. Change the demo password before public use.

## Important production note
This manual payment version does not automatically verify bank/KPay transactions. **Admin verification is required.** For a real public launch, use a persistent production database and persistent/object storage for uploaded product files and payment screenshots.
