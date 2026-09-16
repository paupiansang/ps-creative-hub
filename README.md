# PS Creative Hub V7 — Clean Local Build

This is the clean standalone local build. Do not mix it with V1–V6.

## Start
1. Extract this ZIP to `C:\PS\PS\Website\PS-Creative-Hub-V7`.
2. Double-click `START.bat`.
3. Keep the black server window open.
4. Open `http://localhost:3000`.

## Admin
Open `http://localhost:3000/admin.html`. The first run creates the demo admin from `.env`.

## Local premium test
`TEST_CHECKOUT=true` lets you test the premium purchase flow without real money. It creates a paid test purchase locally and unlocks My Library.

## Production
Before making the site public, turn off test checkout, configure Stripe, use HTTPS, production database/object storage, strong secrets, webhook verification, backups, and legal/license/refund pages.
