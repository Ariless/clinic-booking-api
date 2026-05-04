# Defense Notes: Request Flow

## How it works together

1. Run `npm run dev`.
2. `server.js` starts the HTTP server (`app.listen(...)`).
3. Express app from `app.js` receives the incoming request.
4. Express walks the **middleware + route stack** in `app.js` top-to-bottom until something sends a response (see **Express basics (defense cheatsheet)** below).
5. The matching handler returns JSON for `/api/v1/...` or HTML for the `/` demo UI; errors end up in the global **`errorHandler`**.

## Short explanation for interview

- `app.js` is API composition: middlewares, routes, error handler.
- `server.js` is process startup: reads env and binds app to a port.
- This separation makes testing easier because tests can import `app` without starting a real server.

## Express basics (defense cheatsheet)

### What Express is

- **Express** is a **Node.js library** for HTTP servers: map **method + path** to handler functions, send JSON/HTML/files, and build a **middleware pipeline**.
- Without it you would parse raw HTTP manually; Express gives **`req`** (incoming request), **`res`** (outgoing response), and **`next`** (hand off to the next layer).

### Handler shape: `(req, res, next) => { … }`

- **`req`** — URL, route params (`req.params`), query (`req.query`), body (after `express.json()` → `req.body`), headers, and custom fields (e.g. `req.requestId`).
- **`res`** — set status and body: `res.status(200).json(…)`, `res.sendFile(…)`, etc.
- **`next()`** — “I am done with my part; run the **next** registered middleware/route.”
- **`next(err)`** — “This is an error; jump to the **error handler**” (in this project: JSON with `errorCode`, `message`, `requestId`).

Arrow functions `(req, res) => {}` vs `function (req, res) {}` are **style**; Express accepts both. Named handlers (`function listDoctors(req, res) { … }` then `router.get("/", listDoctors)`) are equivalent and sometimes clearer while learning.

### Middleware vs routes (same mechanism, different intent)

- **Middleware** — reusable steps for **many** requests: set a header, assign `requestId`, parse JSON body, `static` files, auth checks, logging.
- **Route** — a handler tied to a **specific HTTP method + path pattern** (e.g. `GET /api/v1/doctors/:id/slots`). Under the hood it is still middleware; **`router.get` / `router.post`** register “match this path, then run this function.”
- **`app.use("/api/v1/doctors", doctorsRoutes)`** mounts a **sub-router**: only requests whose path starts with that prefix enter `doctorsRoutes`; inside, paths are relative to the mount (e.g. `"/:id/slots"`).

### How a request walks **top to bottom** through `app.js`

Express evaluates registered layers **in order**. If a layer does not match, control moves on. If it matches and calls **`next()`** (no response sent yet), the next layer runs. If a handler **sends a response**, processing for that request typically **stops** there.

Order in this repo (see `src/app.js`):

1. **Global header** — set `X-Clinic-Booking-Learning`, `next()`.
2. **`requestId`** — set `req.requestId`, **`X-Request-Id`** response header, `next()`.
3. **`express.json()`** — parse JSON body when present, `next()`.
4. **`/api/v1/auth`** → `authRoutes`; **`/api/v1/ai`** → `aiRoutes`.
5. **`/api/v1/doctors`** → `doctorsRoutes` (if path prefix matches).
6. **`/api/v1/appointments`** → `appointmentsRoutes` (if prefix matches).
7. **`/api/v1`** → index router (`GET /api/v1`, `error-test`, …) — mounted **after** more specific `/api/v1/...` routers.
8. **`mountSwagger(app)`** — **`GET /api/docs`** (Swagger UI) and **`GET /api/openapi.yaml`**.
9. **`GET /`** — explicit `sendFile(index.html)` for the demo UI.
10. **`express.static(public)`** — serve other files from `public/` if they exist; otherwise `next()`.
11. **`/` + healthRoutes** — e.g. `GET /health`.
12. **`notFoundHandler`** — unknown route → `404` passed as `next(err)`.
13. **`errorHandler`** — **four arguments** `(err, req, res, next)` — final JSON error contract.

**Interview line:** “We keep global concerns first, versioned API routers from specific to generic, static/UI, then 404, then a single error handler so clients always get the same error shape.”

## Step 3 completed (skeleton API)

- Implemented `GET /health` that returns `200` and `{ "status": "ok" }`.
- Implemented versioned entry endpoint `GET /api/v1` with service name and version.
- Kept responsibilities separated:
  - `server.js` starts the process,
  - `app.js` composes routes.

## Interview-ready rationale

- Versioning from day one (`/api/v1`) helps evolve API safely without breaking clients.
- Health endpoint is used for quick runtime checks and future monitoring probes.
- Separation of app composition and server startup improves testability and maintainability.

## Step 4 completed (centralized error handling)

- Added global error middleware that returns consistent JSON:
  - `errorCode`,
  - `message`.
- Added test endpoint `GET /api/v1/error-test` that throws a custom error.
- Verified middleware catches thrown route errors and maps them to HTTP status.

## Interview-ready rationale (errors)

- Centralized error handling prevents duplicated `try/catch` in every route.
- A single error response shape makes frontend integration and API tests simpler.
- Custom `err.status` and `err.errorCode` support domain-specific errors while preserving fallback `500 INTERNAL_ERROR`.

## Step 5 completed (404 + requestId)

- Added `requestId` middleware and attached a unique id to every request.
- Added `notFoundHandler` for unknown routes (`404`, `NOT_FOUND`).
- Wired middleware order correctly:
  - `requestId` -> routes -> `notFoundHandler` -> `errorHandler`.
- Extended error response with `requestId` for easier tracing/debugging.

## Interview-ready rationale (observability)

- `requestId` helps correlate client errors with server logs.
- Dedicated 404 middleware keeps "unknown route" behavior explicit and consistent.
- Stable error contract (`errorCode`, `message`, `requestId`) improves QA automation and client integration.

## Observability-driven testing

The companion test repo (`clinic-booking-api-tests`) includes `observability.loki.test.js` — tests that go beyond HTTP assertions and verify the system logged the right thing:

1. After `POST /api/v1/appointments`, query Loki for the `X-Request-Id` returned in the response header — assert the log entry appeared.
2. Parse the log line and assert `event=appointment.booked`, correct `patientId` and `appointmentId`.

**Why this matters:** most QA automation stops at the HTTP boundary. Verifying that the system emits the correct structured log entry proves the observability contract — not just that the API responded correctly, but that the internal state was recorded as expected. In production systems, structured logs are the primary signal for incident investigation.

**Interview line:** *"I have tests that query Loki after an API call and assert the structured log entry appeared with the correct event, requestId, and domain fields. It's one of the few QA signals that crosses the HTTP boundary and validates observability, not just functionality."*

**Stack:** `docker-compose.observability.yml` — Loki + Promtail + Grafana on `:3030`. Promtail scrapes Pino JSON from the Docker container. Tests use Loki's query_range API with a polling loop (15s timeout) to account for Promtail ingestion delay.

## Step 6 completed (config / env)

- Centralized env in `src/config/env.js`: `PORT`, `NODE_ENV`, **`DATABASE_PATH`** (relative path like `./data/clinic.db`).
- `NODE_ENV` must be one of `development`, `test`, `production`; invalid value fails fast at startup.
- `PORT` parsed with `Number(process.env.PORT)` with fallback `3000`.
- `server.js` uses `env.PORT`; `GET /api/v1` exposes `environment` from `env.NODE_ENV`.

## Interview-ready rationale (config)

- Single module for env avoids scattered `process.env` reads and typos.
- Fail-fast on boot catches misconfiguration before serving traffic.
- `Number(process.env.PORT)` avoids subtle bugs when `PORT` is compared or logged as string.

---

## Agreed project order (do not shuffle without reason)

1. **Backend + domain logic** — DB, entities, HTTP API, validation, errors (**current**: JWT auth, patient-only booking/cancel, doctor confirm/reject, slot create/delete for own diary, soft-delete user, rule-based AI).
2. **Frontend** — UI (`public/` + `express.static`) consuming the API (**MVP demo done**: patient/doctor workspaces, register/login, confirmations on destructive actions).
3. **Integration** — same-origin `fetch` from `/` to `/api/v1/...` (**done** for current setup); add **CORS** only if the UI moves to another origin/port.
4. **Automated tests** — meaningful API + E2E (e.g. Playwright) once behaviour is worth showing; no placeholder-only runners.

*Recorded 2026-04-21 so chat/work context can be restored.*

---

## Backend persistence (SQLite)

- **Driver:** `better-sqlite3` — single-process, synchronous API; good fit for a small API and learning.
- **`src/db/connection.js`:** resolve DB file with `path.resolve(process.cwd(), env.DATABASE_PATH)`; `mkdirSync` on **`path.dirname(dbPath)`** only (never `mkdir` on the `.db` file path).
- **`src/db/migrate.js`:** `migrate()` runs `db.exec(...)` for `CREATE TABLE IF NOT EXISTS` (doctors, slots, appointments, users); **`server.js` calls `migrate()`** before `listen` so schema exists on every boot.
- **`scripts/seed.js`:** `npm run db:seed` — clears **`appointments` → `slots` → `doctors` → `users`**, then seeds doctors, slots, users with **bcrypt** password hashes and **`doctorRecordId`** on the demo doctor user; logs demo logins (`password`). Booking in production use is **`POST /api/v1/appointments`** with **patient JWT** and body **`{ slotId }`** (see **`API_ENDPOINTS.md`**).

## Interview-ready rationale (persistence)

- Migrations at startup keep local/dev environments consistent without a separate migration CLI at MVP size.
- Repository layer keeps SQL out of route handlers — easier to test and swap storage later.

---

## Auth + JWT

- **`POST /api/v1/auth/register`** / **`POST /api/v1/auth/login`** — **bcrypt** password hashes; **`jsonwebtoken`** issues **`JWT_SECRET`**-signed tokens (`sub`, `role`, `doctorRecordId`).
- **`GET /api/v1/auth/me`** — **`requireAuth`**; returns **`{ user, doctorProfile }`** (`doctorProfile` from directory when `doctorRecordId` is set).
- **`DELETE /api/v1/auth/me`** — **`requireAuth`**; **patient** or **doctor** only — **`usersRepository.softDeleteUser`** → **`204`**.
- **`src/middlewares/auth.js`** — **`requireAuth`** (Bearer) + **`requireRoles(...)`** for **401** / **403**.
- **`JWT_SECRET`:** required in **production**; dev fallback in `src/config/env.js` (see `.env.example`).

## Known security gap — doctor self-registration

`POST /api/v1/auth/register` accepts `role: "doctor"` from any caller. The only guard is that the provided `doctorRecordId` must exist in the `doctors` table. Anyone who can enumerate valid IDs (1, 2, 3 — predictable after `db:seed`) can create a doctor-privileged account without any admin approval.

**In a real system:** close this with one of: invite-token flow (admin creates a single-use link), admin-only endpoint for doctor account creation, or a pending-approval state before the account is activated.

**Interview line:** *"I noticed that doctor registration only validates the record ID exists — there's no ownership proof or admin gate. In production I'd add an invite token or admin approval step."*

## Payments — online consultations

- **Endpoint:** `POST /api/v1/consultations` — separate paid service, does not touch the appointments flow.
- **Feature flag:** `PAYMENT_MODE=disabled|mock_success|mock_fail` — same pattern as `ENABLE_AI_RECOMMENDATION`. Default `disabled` → `503 FEATURE_DISABLED`. Existing tests never see payment logic.
- **Mock provider:** `src/services/paymentService.js` — `charge()` returns success or failure based on env var. No external dependency.
- **DB tables:** `consultations` + `payments`. Payment record written on both success and failure — `consultationId` is `null` on failure. This preserves a full audit trail of charge attempts.
- **Idempotency:** `X-Idempotency-Key` header — if key already exists in `payments` table for this patient, return cached result without re-charging. First call → `201`, replay → `200`, same `consultationId`.
- **402 Payment Required** — consultation row is never created if payment fails. DB assertion proves it.
- **Interview line:** "I implemented idempotency the way real payment APIs work — the client sends a unique key, and the server guarantees exactly-once processing. The test proves it at the DB level: two requests with the same key produce exactly one payment row."

## WebSocket notifications

- **Endpoint:** `ws://localhost:3000/ws?token=<JWT>` — same port as HTTP; Node's `http.Server` detects the upgrade handshake and routes it to `WebSocketServer`.
- **Auth:** JWT extracted from query string on connect; invalid or missing → `ws.close(4001)`; patient role → `close(4003)`. Same `jwt.verify()` + `usersRepository.getPublicById` as HTTP middleware.
- **Connection store:** `src/ws/connections.js` — `Map<doctorRecordId, Set<ws>>`; one doctor can have multiple browser tabs open. Added on connect, removed on `close` and `error`.
- **Events pushed to doctor:** `appointment.booked` (patient books) and `appointment.cancelled_by_patient` (patient cancels). `wsNotifier.notifyDoctor()` iterates the Set and calls `ws.send()` for each `OPEN` socket.
- **UI:** `doctor-appointments.html` — on `ws.onmessage` shows a toast and calls `loadAppointments()` to refresh the list without F5.
- **Interview line:** "HTTP and WebSocket share port 3000. The server detects the upgrade handshake and routes it separately. Doctors hold a persistent connection; the server pushes events without polling. Invalid token → 4001, wrong role → 4003 — the same auth logic as HTTP, just applied at connection time instead of per-request."

## AI (demo)

- **`POST /api/v1/ai/recommend-doctor`** — rule-based **`src/services/aiRecommendation.js`** (keywords → allowed specialty → `doctorsRepository.getBySpecialty`); **422** `UNKNOWN_SPECIALTY` when no match.

## Doctors API (read + write)

- **`GET /api/v1/doctors`** — list from `doctorsRepository.getAll()`.
- **`GET /api/v1/doctors/:id`** — one row; **404** + domain `errorCode` (e.g. `DOCTOR_NOT_FOUND`) when missing.

## Slots API (read + create + delete)

- **`GET /api/v1/doctors/:id/slots`** — only **available** slots for that doctor (`slotsRepository.getAvailableByDoctorId`).
- **`GET /api/v1/doctors/me/slots`** — **JWT doctor** with linked **`doctorRecordId`**; **all** slots (available + booked) for diary UI.
- **`POST /api/v1/doctors/me/slots`** — same create as below but uses JWT’s **`doctorRecordId`** (no `:id` in path).
- **`DELETE /api/v1/doctors/me/slots/:slotId`** — **JWT doctor**; deletes row only if owned and **no** appointments reference the slot (`409` `SLOT_IN_USE` otherwise) → **204**.
- **`POST /api/v1/doctors/:id/slots`** — **JWT doctor** whose **`doctorRecordId`** matches `:id`; **`slotsRepository.insertSlot`** → **201** (validates `endTime` after `startTime`).
- **404** `DOCTOR_NOT_FOUND` / **`SLOT_NOT_FOUND`** as applicable; **400** `VALIDATION_ERROR` if ids or datetimes invalid.
- Router order: **`/me/slots`**, **`/me/slots/:slotId`**, then **`/:id/slots`**, then **`/:id`** so `me` is not captured as `:id`.

## Appointments API (write + read)

- **`POST /api/v1/appointments`** — **JWT patient**; body **`{ slotId }`** (positive integer). Patient id is **`req.user.id`**. Transaction: slot exists → available → patient user exists → insert appointment (`pending`) → **`slots.isAvailable = 0`**. Returns **201** + created row.
  - **401** / **403** if not patient; **404** `SLOT_NOT_FOUND`, **409** `SLOT_TAKEN`, **404** `PATIENT_NOT_FOUND`, **400** `VALIDATION_ERROR`.
- **`GET /api/v1/appointments`** and **`GET /api/v1/appointments/my`** — **JWT patient**; both list **`getAppointmentsByPatientId(req.user.id)`** (same behaviour).
- **`GET /api/v1/appointments/doctor`** — **JWT doctor** with **`doctorRecordId`**; lists **`getAppointmentsByDoctorId(doctorRecordId)`**.
- **`PATCH /api/v1/appointments/:id/cancel`** — **JWT patient**; **`patientId`** taken from **`req.user.id`** (no body required). Transaction sets **`cancelled`** + frees slot when allowed; **403** / **422** / **404** as applicable.
- **`PATCH /api/v1/appointments/:id/confirm`** / **`reject`** — **JWT doctor**; transaction checks slot ownership; **`pending` → `confirmed`** or **`rejected`** (reject frees slot); **403** / **422** / **404**.
- **`GET /api/v1/appointments/:id`** — one row (unauthenticated); **404** `APPOINTMENT_NOT_FOUND`; **400** if id invalid.
- **`appointmentsRepository.getAppointmentsByDoctorId`** uses **`JOIN slots`** (appointments have no `doctorId` column).

## Demo UI + static files

- **`public/`** — multi-page demo: home hub, **patient** (`/patient`, booking, schedule, appointments, account), **doctor** (`/doctor`, …), **login/register** (same-origin **`fetch`** to `/api/v1/...`).
- **`app.js`:** explicit **`GET /`** → `sendFile(index.html)` so `/` is never a silent 404; then **`express.static(publicDir)`**.
- **`app.js`:** response header **`X-Clinic-Booking-Learning: 1`** on every response — quick sanity check that traffic hits this app (e.g. `curl -sI http://localhost:PORT/ | grep -i x-clinic`).
- **`server.js`:** fails fast if **`public/index.html`** is missing; logs demo URL and a one-line `curl` sanity hint.

## Express middleware / route order (gotcha)

- Mount **more specific** API paths **before** generic ones: e.g. **`/api/v1/auth`**, **`/api/v1/ai`**, **`/api/v1/doctors`**, **`/api/v1/appointments`** before **`/api/v1`** (index router), so those paths are not swallowed or mis-ordered.
- **`errorHandler` must stay last** — nothing after it will run for normal routing.

---

## Automated tests (current stance)

- **Vitest / API smoke removed** on purpose until there is **business-level** behaviour to protect (booking rules, auth, etc.) and **Playwright** E2E against a real UI.
- **Lint** (`npm run lint`) remains the daily quality gate until the test matrix is worth publishing.

---

## Test orthogonality map

Every test file in the companion test repo covers a **unique risk dimension** — no two files test the same thing. The map (§17 in `TEST_STRATEGY.md`) lists all 36 files split by layer (API / E2E / UI), each with the single question it answers.

**Interview line:** *"I maintain a test orthogonality map — a table of every test file and the unique risk dimension it covers. If two files answer the same question, one of them is a duplicate. If I add a new file, it must cover a new risk — otherwise it belongs in an existing file. It's a systems-thinking tool: coverage is designed, not accumulated."*

---

## CI prioritization rationale (risk vs infrastructure cost)

Three suites are intentionally local-only, with explicit reasoning documented in §13 of `TEST_STRATEGY.md`:

| Suite | Why excluded from CI |
|---|---|
| `chaos.test.js` | Needs a fault-injected SUT; runs via separate manual `chaos.yml` workflow |
| `observability.loki.test.js` | Needs Loki stack sidecar; high infrastructure cost for the CI signal gained |
| `rate-limit tests` | Parallel CI runs exhaust the rate window and produce false 429s; needs env override |

Each exclusion has an unblocking condition. The point is that running these in the standard job would produce flaky failures caused by missing infrastructure — the exact failure-classification problem the framework is designed to avoid.

**Interview line:** *"Not every test belongs in CI. I made three explicit exclusions: chaos tests need a fault-injected server, observability tests need a Loki stack, and rate-limit tests produce false 429s in parallel runs. Each has a documented unblocking condition. Putting them in CI anyway would make the pipeline unreliable — and an unreliable pipeline is worse than no pipeline."*

---

## Waitlist offer system (manual confirmation flow)

The SUT implements a two-stage waitlist: when a slot frees up and the next queued patient already has an active booking, instead of automatic promotion an **offer** is created. The patient then decides:

- **Accept** — old booking cancelled + old slot freed, new appointment created on the freed slot, waitlist entry removed.
- **Decline** — original booking unchanged, patient stays on waitlist, freed slot offered to the next eligible patient.

Key design decisions:
- Declined patients are skipped for the same slot (NOT EXISTS on `waitlist_offers.status = 'declined'`) but stay in the queue for future slots.
- `promoteFromWaitlist` is called inside the decline transaction so the slot is immediately re-offered — no async delay.
- Offers have a configurable TTL (`WAITLIST_OFFER_TTL_HOURS`, default 24h) to prevent indefinitely held slots.
- Direct promotion (no existing booking) still works atomically in the same transaction — offer path is only triggered when a conflict exists.

Files: `src/repositories/offersRepository.js`, `src/repositories/waitlistRepository.js`, `src/db/migrate.js` (table `waitlist_offers`), routes in `src/routes/appointmentsRoutes.js`.

Tests: `appointments.waitlist.offers.test.js` — 4 tests: GET pending offers, accept (swap), decline (keep original), 409 on double-accept.

**Interview line:** *"The waitlist has two modes: if the patient has no existing booking, they're promoted automatically in the same transaction. If they do have a booking, I create an offer and hold the slot — the patient accepts to swap or declines to stay in queue. A declined patient is excluded from the next promotion for that specific slot but stays eligible for future freed slots. This prevents an infinite offer loop after each decline."*

---

## Next slices (suggested)

Already in the codebase (no longer “next” for these): **user** soft-delete, **doctor** cancel visit (`PATCH …/cancel-as-doctor`), **DB** partial unique guard for double active booking per slot, **refresh JWTs**, slot **overlap** check per doctor, **`X-Request-Id`** on responses.

Reasonable follow-ups when you want to go deeper:

- **Backend:** optional soft delete on **appointments** rows (today lifecycle is status-only); **external AI** (e.g. Anthropic) behind a feature flag instead of/in addition to `aiRecommendation.js`; richer `/health` (DB ping); **WebSocket notifications** — real-time push to doctor's browser (webhook outbound is already implemented in `src/services/notificationService.js`).
- **Frontend:** more UX polish; **CORS** if the UI is served from another origin (e.g. Vite dev server).
- **Tests:** **Supertest** / **Playwright** when you start the automated test track (deferred by choice).

Ideas and deferred experiments live in **`PROJECT_PLAN.md`** → section **Backlog** (e.g. SPA/Vite + client routing).

**Endpoint inventory (implemented vs planned):** **`API_ENDPOINTS.md`**.

**OpenAPI / Swagger:** interactive docs at **`/api/docs`**, machine-readable YAML at **`/api/openapi.yaml`**; source of truth file **`openapi/openapi.yaml`** (edit when routes change — no codegen from comments).

*Last synced: 2026-04-21 — plan/defense pass: AI path = `src/services/aiRecommendation.js`; auth refresh; doctor cancel-as-doctor; DB partial unique booking; slot overlap + slot delete rules; register email rules; `X-Request-Id`; “next slices” reflects what is already shipped vs still deferred.*
