# Testing against this SUT (system under test)

This service and the **`public/`** demo UI are built to be **exercised by automation**: stable HTTP errors, documented transitions, **`data-qa`** hooks, and optional **API-first** setup. Your **test framework repo** should own architecture (Page Objects, runners, CI); **this document** tells you what the SUT gives you and how to avoid common traps.

**Related docs:** **`README.md`** (run, layout), **`API_ENDPOINTS.md`** (routes + seed logins), **`CONTRACT_PACK.md`** (state machine, RBAC, **`errorCode`**), **`DEFENSE_NOTES.md`**, **`openapi/openapi.yaml`**, **`quality-strategy.md`** (`data-qa` naming, logging, deferred Loki idea).

---

## 1. Recommended test shape (pyramid-aware)

| Layer | What to assert | Why it reads “senior” |
| --- | --- | --- |
| **API** | Status, JSON body, **`errorCode`**, RBAC (403 vs 401), transitions | Fast, stable, good for rules and negatives |
| **UI** | Happy paths and critical regressions on `public/` | Covers integration the API alone does not see |
| **Cross-check** | After a UI action, **poll API** (`GET /api/v1/appointments/my`, doctor list, slots) | Catches “green UI, wrong server state” |
| **Logs (optional)** | Correlate **`requestId`** / **`X-Request-Id`** with Pino lines | Strong story; needs log capture in CI (not wired here — see **`quality-strategy.md`** *Logging* → planned) |

You do **not** need all four on every test; use **API for coverage density**, **UI for thin smoke + flows**, **cross-check** on booking/cancel/waitlist, **logs** for one or two demo scenarios.

---

## 2. Running the SUT for automation

1. **`cp .env.example .env`** — set at least **`JWT_SECRET`** for anything beyond local defaults.
2. **`npm ci`** then **`npm run dev`** (or **`npm start`** in CI-style runs).
3. **`GET /health`** until **`checks.database`** is acceptable for your suite gate.
4. **Data baseline**
   - **`npm run db:seed`** — deterministic wipe + demo doctors/slots/users (passwords and emails: **`API_ENDPOINTS.md`** → *Demo seed*).
   - Or **register via API** with unique emails per test run (avoids `EMAIL_TAKEN`; mind **`EMAIL_RETIRED`** if you reuse emails after account close).

**SQLite + parallel workers:** the default DB is a **single file** (`./data/clinic.db`). True parallel UI/API tests against one file can cause lock contention. Prefer **one worker**, **sequential** API suites, or **separate `DATABASE_PATH` per worker** (separate processes each with its own env) if you need isolation.

---

## 3. UI automation (`public/`)

### Selectors

- Use **`[data-qa="…"]`** / Playwright **`getByTestId`** after setting **`use: { testIdAttribute: 'data-qa' }`**.
- Full naming rules and legacy caveats: **`quality-strategy.md`** → *Demo UI — stable selectors (`data-qa`)*.

### Async and flakiness

- Prefer **assertions on stable DOM or API state**, not fixed `sleep`.
- After submits that call **`ClinicApp.api`**, wait for **visible success/error** or for a **network response** you control in Playwright (`waitForResponse` on `/api/v1/...`).
- The demo uses **401 → refresh → retry** in **`public/js/app-core.js`**; first request may succeed on retry — design waits around **user-visible** outcomes or final API state.

### Guests vs authenticated

- **Doctor** HTML routes expect a doctor session (guests redirected to login).
- **Patient** booking: guests can **browse**; **booking** needs a **patient** JWT in the app storage.
- If tests open **`/patient`** or **`/doctor`** cold, behaviour may differ from “came from home/login”. Optional future flag is discussed in **`TODO.md`** (*Guest mode*); until then, tests should **set session via UI login or inject tokens** as your framework prefers.

---

## 4. API client layer (recommended in your framework)

- **Base URL** from env (e.g. `PLAYWRIGHT_BASE_URL` / `SUT_BASE_URL`).
- **Small typed or untyped client** with helpers: `register`, `login`, `book(slotId)`, `listMyAppointments`, `confirm(id)`, etc. — paths and bodies in **`API_ENDPOINTS.md`** / OpenAPI.
- **Attach** `Authorization: Bearer <access>` only on protected routes; refresh flow is a **browser** concern in this demo — for pure API tests, call **`POST /api/v1/auth/login`** (or register) per suite or use long-lived tokens you store in fixture state.

---

## 5. Test data strategy

| Approach | When to use | Cleanup / idempotency |
| --- | --- | --- |
| **`npm run db:seed`** before suite / module | Deterministic golden paths, screenshots | Wipes **all** demo data; not for shared remote env without coordination |
| **Register** unique `patient+${Date.now()}@…` | Parallel-safe **logical** users (still watch SQLite locking) | Optional **`DELETE /api/v1/auth/me`** as patient/doctor to soft-close; or rely on next seed in local CI |
| **Fixed seed users** | Fast smoke (`patient@example.com`, `doctor@example.com`, …) | Mutations persist until next seed — order tests or reset |

**Factories** (email/name/password builders) and **idempotent teardown** belong in **your** test repo; the SUT only exposes the HTTP surface above.

---

## 6. Assertions that impress (concrete hooks)

1. **Error contract:** every non-2xx JSON has **`errorCode`**, **`message`**, **`requestId`**; header **`X-Request-Id`** matches **`requestId`** where applicable.
2. **Domain:** after **`POST /api/v1/appointments`**, slot disappears from **`GET /api/v1/doctors/:id/slots`** when booked; transitions match **`CONTRACT_PACK.md`**.
3. **Rate limit:** rapid **`POST /api/v1/ai/recommend-doctor`** → **`429`** `RATE_LIMITED` — throttle tests or space calls.
4. **Feature off:** `ENABLE_AI_RECOMMENDATION=false` → **`503`** `FEATURE_DISABLED` (assert stable code).
5. **Concurrency narrative:** with **`NODE_ENV=development`** and **`ENABLE_DEBUG_ROUTES=true`**, **`POST /api/v1/debug/simulate-concurrent-booking`** documents sequential double-book; for **true** races use **two parallel HTTP clients** from your runner (same body shape as in **`API_ENDPOINTS.md`**).

---

## 7. What this SUT does **not** include (avoid false claims)

- **No `npm test`** in this repository; CI here is **`npm run lint`** only.
- **No shipped “chaos” / “buggy” API mode** in runtime — those remain **plan/backlog** (**`PROJECT_PLAN.md`**). Do not document them as live switches until implemented.
- **“AI fallback”** today means: **rule-based** recommendation path, optional **503** when disabled, **429** under throttle — not a separate external LLM failover unless you add it later.

---

## 8. Playwright-oriented checklist (minimal)

- [ ] Config: **`testIdAttribute: 'data-qa'`**.
- [ ] Global setup: health (and optional seed).
- [ ] API fixtures: login/register → token → booking primitives.
- [ ] UI projects: one spec per major flow (login → book → list → cancel) with **API reconciliation** on critical steps.
- [ ] AI tests: respect **rate limit** or mock at HTTP layer.
- [ ] CI: your framework repo runs Playwright + API; this repo stays the **SUT** build step (`npm ci`, `npm run dev` or Docker, then tests).

---

## 9. Operational endpoints for probes

| Endpoint | Use in tests |
| --- | --- |
| **`GET /health`** | Gate suite; assert `checks.database` (and `checks.ai` if AI tests depend on it) |
| **`GET /metrics`** | Before/after deltas on booking counters (in-memory; resets on restart) |
| **`GET /api/v1/error-test`** | Smoke that JSON error pipeline returns **418** + structured body |

---

## 10. Where to put “Mid/Senior story” in your portfolio

Keep **this file** as the **SUT contract for testers**. Put **Page Object layout, retries policy, shard strategy, CI matrix, and flaky-playbook** in the **automation repository README** — that is where reviewers look for engineering depth. Link from there **to this file** so the boundary stays clear: **SUT vs framework**.

---

## Appendix — Résumé and interviews (honest framing)

Use a **two-repo** story only if both exist: **(1) SUT** — this service + demo UI; **(2) automation** — Playwright/API harness, factories, CI. That split matches how many teams separate **product code** from **test code**.

**Safe claims today (aligned with this repository):**

- REST booking API with **documented roles**, **appointment transitions**, and a **single error JSON shape** + **`requestId` / `X-Request-Id`**.
- Demo **multi-page UI** under `public/` with stable **`data-qa`** selectors (conventions in **`quality-strategy.md`**).
- **Rate-limited** AI recommend endpoint (rule-based); **debug** booking race helper under strict env flags (**`API_ENDPOINTS.md`**).
- **Lint CI** on this repo; automated **Playwright/API suites** belong in the **framework** repo once you ship them.

**Do not imply these are already live in the SUT** (unless you implement or simulate them in the framework and say so explicitly):

- **“Chaos” / “buggy” API runtime modes** — still **backlog** (**`PROJECT_PLAN.md`**), not switches you can turn on today.
- **“Environment switching normal / buggy / chaos”** — only a strong resume line once **`baseURL`** or **fault injection** is real in your test stack or the API gains those modes.

**Example one-liner (English, defensible now):**

> *I treat this service as a controlled SUT: contract-first HTTP, RBAC and state rules in docs, stable `data-qa` for UI checks, and API-first setup with cross-layer assertions where it matters.*

Deeper **SDET** wording (parallel sharding, tagging, factory teardown, log correlation in CI) should cite **your automation repository** once those pieces exist there.
