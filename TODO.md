# Follow-ups

- **QA / E2E selectors:** Hooks and naming rules are documented in **`quality-strategy.md`** → *Demo UI — stable selectors (`data-qa`)*. Implementation lives on each page under `public/` (`page-*` on `<body>`, shared `site-*` / nav prefixes, feature keys; dynamic controls set `data-qa` in scripts).

- **Guest mode on `/patient` and `/doctor` (later):** Optionally block or soften “accidental” guest access: show a banner for unauthenticated users (e.g. “Choose your mode on the home page first” / link to `/` and **Continue as guest** on `/login`) instead of loading the full workspace UI. **Trade-off:** E2E or manual tests that open `/patient`, `/patient/booking`, `/doctor`, etc. directly without visiting `/` or `/login` would need a flag (e.g. `?allowGuest=1`, `sessionStorage` set by a test helper, or a dedicated `NODE_ENV=test` bypass) so direct URLs keep working.

---

## Known limitations

- **Waitlist double-booking** — ✅ fixed 2026-05-02. `getNextWaitlistEntry` in `waitlistRepository.js` now skips patients who already have an active (`pending`/`confirmed`) appointment with the same doctor (`NOT EXISTS` subquery). Test: `appointments.waitlist.promotion.test.js` — "patient with active appointment is skipped during waitlist promotion".

- **Waitlist offer system (Variant B)** — ✅ implemented 2026-05-02. When a slot frees up and the next waitlist patient already has an active booking, an offer is created instead of immediate promotion. Patient accepts (old booking cancelled, new one created, waitlist removed) or declines (stays on waitlist, slot offered to next person). `promoteFromWaitlist` export fix applied. Tests: `appointments.waitlist.offers.test.js` (4 tests, all passing).

---

## Code cleanup backlog (from internal audit, 2026-04)

Addressed in a hygiene pass:

- Removed unused **`updateAppointment` / `deleteAppointment`** from `appointmentsRepository`.
- **`postLoginPath`** — no longer on `ClinicApp` public object (still used internally by `resolveAfterLoginUrl`).
- **`server.js`** — startup asset list includes **`js/app-nav.js`** and **`js/directory-by-specialty.js`**.
- Removed deprecated **`guardPatientRedirect`** from `ClinicDoctorShell` (callers already use `guardDoctorWorkspace`).
- **`GET /api/v1/appointments`** and **`GET /api/v1/appointments/my`** — shared handler `listMyAppointments` (routes kept for compatibility / OpenAPI).
