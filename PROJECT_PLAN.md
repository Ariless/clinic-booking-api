# clinic-booking-api — Updated Project Plan

## Chat Context Snapshot (2026-04-21)

This section preserves the current mentoring workflow so progress is not lost if chat/session resets.

- Goal shifted from "ship ready API quickly" to "learn by building manually for interviews and job offer preparation".
- We keep existing `clinic-booking-api` as a reference and build a new training project from scratch.
- New training project path: `clinic-booking-api-learning`.
- Working mode agreed:
  - assistant gives one step at a time,
  - user implements independently,
  - assistant reviews and explains gaps, best practices, and modern patterns.
- Process rule:
  - do not copy full old implementation blindly,
  - transfer documentation gradually and only for features already implemented in the new project.

Current checkpoint:
- Step 1 completed: new project folder initialized.
- Step 2 completed: base dependencies, scripts, `.env` / `.env.example`.
- **Docs (2026-04-21):** `API_ENDPOINTS.md`, `DEFENSE_NOTES.md`, `CONTRACT_PACK.md` synced with API; **`PROJECT_PLAN.md`** + **`DEFENSE_NOTES.md`** second pass — AI path (`aiRecommendation.js`), auth refresh, doctor cancel, DB booking guard, slot rules, iteration checklists, “next slices” vs shipped features.
- **Companion Playwright repo (`clinic-booking-api-tests`):** agreed **risk-first API test strategy** and J1/J3 split — see section **External companion: Playwright API tests** below (fixed 2026-04-21; implementation in the test repo may trail this doc until picked up).

---

## External companion: Playwright API tests (`clinic-booking-api-tests`)

**Goal:** portfolio + interview — tests are a **map of risks and invariants**, not “coverage percentage”.

### Principles
- **One file ≈ one thesis** (one class of user/business harm if it regresses).
- **`@smoke`** only on a **narrow** slice (e.g. login, one critical path fragment, RBAC boundary, catalog).
- Avoid **two tests turning red for one broken transition** unless they assert **different invariants**; prefer a clear split of responsibility (J1 vs J3).

### Target decomposition: J1 vs J3 (removes duplicate “confirm story”)

| Piece | Responsibility | Interview line |
| --- | --- | --- |
| **J1** (`appointments.mini.j1.*`) | **User intent:** slot → book → **pending** visible in `GET /api/v1/appointments/my`. **Stops before** doctor confirm. | “I isolate the patient-visible commitment before the doctor acts.” |
| **J3** (`appointments.confirm.j3.*`) | **System transition:** doctor **confirm** → `confirmed` in `/my` + **slot invariants** (e.g. slot absent from public `GET /api/v1/doctors/:id/slots` per contract). | “Confirm is a state transition + diary/catalog invariants, not the same test as ‘I booked’.” |
| **J2** (`appointments.reject.j2.*`) | **Alternative branch:** reject + slot **returns** to bookable state. | “Reject is a first-class branch, not a failed confirm.” |
| **RBAC** (`appointments.rbac.doctor.*`) | Patient JWT must **not** read doctor’s list (`403` / `FORBIDDEN`). | “Cross-role data boundary — privacy/compliance class risk; stays in smoke.” |

**Note:** Companion **`clinic-booking-api-tests`** implements the split above (`appointments.mini.j1` → **pending** only in smoke; **`appointments.confirm.j3`** owns confirm + slot invariants under **`@api`**).

### Must-add API tests (next implementation batch in `clinic-booking-api-tests`)

1. ~~**`appointments.booking.conflict`**~~ **Done** in companion: `appointments.booking.conflict.test.js` (`@api`) — patient A books (`201`), patient B `POST /appointments` same **`slotId`** → **`409`**, **`errorCode`** `SLOT_TAKEN` (fixture **`user`** + **`seedPatient`**).
2. ~~**`appointments.cancel.patient`**~~ **Done** in companion: `appointments.cancel.patient.test.js` (`@api`) — `PATCH /api/v1/appointments/:id/cancel` → `200`, status `cancelled`, slot freed and visible in public doctor slots.
3. ~~**Rate limit tests**~~ **Done** in companion: describe blocks in **`auth.login.test.js`** and **`auth.register.test.js`** + new file **`appointments.booking.rate-limit.test.js`** (`@rate-limit`). Run with env overrides: `RATE_LIMIT_LOGIN_MAX=2 RATE_LIMIT_LOGIN_WINDOW_MS=5000`, `RATE_LIMIT_REGISTER_MAX=2 RATE_LIMIT_REGISTER_WINDOW_MS=5000`, `RATE_LIMIT_BOOKING_MAX=2 RATE_LIMIT_BOOKING_WINDOW_MS=5000`. All expect `errorCode: "RATE_LIMITED"` + `429`.

### Second wave (optional)

- **422 / `INVALID_TRANSITION`:** one or two cases (e.g. confirm twice) — contract guard, not a long catalog.
- **`POST /auth/refresh`:** when the “long session” product story matters for the portfolio.

### Interview spine (short script, ~45–60s)

Use **lifecycle + risk zones**: state machine (J1 → J3), alternative branch (J2), **access boundary** (RBAC), **contention** (409 double book), **lifecycle completion** (cancel). If a test fails, name the **business harm** (money/conflict, data leak, inconsistent diary, broken user journey) — not “assertion 7 failed”.

### File naming (companion repo convention)

`{domain}.{feature}[.qualifier].test.js` — examples: `auth.login`, `auth.register`, `doctors.list`, `appointments.mini.j1`, `appointments.reject.j2`, `appointments.confirm.j3`, `appointments.rbac.doctor`, `appointments.booking.conflict`; planned add: `appointments.cancel.patient`.

**Where the full write-up lives (companion repo):** `clinic-booking-api-tests` → **`docs/TEST_STRATEGY.md`** (scope, tags, J1/J2/J3, planned files) and **`docs/RISK_ANALYSIS.md`** (impact × likelihood → tests). **UI + e2e minimal backlog (no duplicate browser J1):** same repo **`E2E_TEST_PLAN.md` → §9**; checklist also in **`TODO.md`** here.

---

## Concept

A doctor appointment booking REST API built for QA practice.  
Designed to be testable by design: clean architecture, Swagger docs, and operational modes for reliability testing.

---

## Tech Stack

- **Node.js + Express** — REST API
- **SQLite + better-sqlite3** — database
- **JWT** — authentication (short-lived access token + refresh token; see `POST /api/v1/auth/refresh`)
- **Swagger / OpenAPI** — API documentation
- **AI (current)** — rule-based specialty + doctor matching in **`src/services/aiRecommendation.js`** (wired by `POST /api/v1/ai/recommend-doctor`)
- **AI (planned)** — external provider (e.g. Anthropic) behind a feature flag; not wired in this repo yet
- **Playwright** — **not bundled in this repo**; the companion **`clinic-booking-api-tests`** repo runs **API (and future UI/e2e) Playwright** against this SUT (or a fork URL) with **GitHub Actions** — see **External companion: Playwright API tests** below and that repo’s `README.md` / `docs/TEST_STRATEGY.md`.
- **AJV** — schema validation in **companion** tests (optional; planned expansion in `clinic-booking-api-tests`; not a runtime dependency of this service)
- **pino** — structured logging (`src/logger.js`, `src/middlewares/http-logger.js`, domain `event` fields in routes)
- **express-rate-limit** — AI recommendation throttle
- **Grafana + Loki** (planned, not in repo yet) — pipe **Pino** JSON from **runs** (local or CI that starts this SUT) into **Loki** / **Grafana** for “tests + observability”; companion Playwright runs already produce logs here — ingestion wiring still deferred; rationale in **`quality-strategy.md`** → *Logging* (planned subsection).

---

## Roles

- **PATIENT**: register/login, view doctors/slots, book slot, view own appointments, cancel own appointment
- **DOCTOR**: login, view own appointments/schedule, confirm/reject, cancel visits (own slots), manage diary slots

---

## Entities

### User
- id
- email (unique)
- password (hashed)
- role (PATIENT / DOCTOR)
- name
- createdAt

### Slot
- id
- doctorId (FK **`doctors.id`** — directory row, not `users.id`)
- startTime (ISO 8601 UTC)
- endTime (ISO 8601 UTC)
- isAvailable (boolean)
- version (for optimistic locking, later iteration — not in DB yet)

### Appointment
- id
- slotId (FK Slot.id)
- patientId (FK User.id)
- status (PENDING / CONFIRMED / REJECTED / CANCELLED)
- createdAt
- updatedAt
- deletedAt (soft delete, later iteration)

---

## Domain Rules

- Booking must be atomic (transaction):
  1) verify slot available  
  2) create appointment  
  3) mark slot unavailable
- Unique booking protection:
  - SQLite **partial unique index** on `appointments(slotId)` for active statuses (`pending`, `confirmed`) — see `src/db/migrate.js`
- RBAC enforced at service/domain layer, not only controllers
- State machine rules centralized in domain/service module

---

## State Machine — Appointment

```text
PENDING   -> CONFIRMED   (doctor)
PENDING   -> REJECTED    (doctor)
PENDING   -> CANCELLED   (patient/doctor, optional policy)
CONFIRMED -> CANCELLED   (patient/doctor)
```

Invalid transitions => `422` (standardized).

- CONFIRMED -> CONFIRMED
- REJECTED -> anything
- CANCELLED -> anything

---

## API Endpoints

### Auth
- POST `/auth/register` (validation: email/password/name/role; `409` `EMAIL_TAKEN` / `EMAIL_RETIRED` when email cannot be used)
- POST `/auth/login` (patient/doctor; returns access + refresh JWTs)
- POST `/auth/refresh` (rotate tokens)
- GET/DELETE `/auth/me` (profile + soft-delete account demo)

### Doctors
- GET `/doctors`
- GET `/doctors/:id/slots` (available slots only — patient / public)
- GET `/doctors/me/slots` (doctor JWT — all slots for diary)
- POST `/doctors/me/slots` and POST `/doctors/:id/slots` (doctor JWT, own record) — create openings; `409` `SLOT_OVERLAP` if interval overlaps another slot **for the same doctor**
- DELETE `/doctors/me/slots/:slotId` — delete when no **active** (`pending`/`confirmed`) appointment; historical cancelled/rejected rows are cleared with the slot

### Appointments (patient)
- POST `/appointments` — **patient JWT**; body `{ slotId }` only; duplicate booking => `409`
- GET `/appointments` and GET `/appointments/my` — **patient JWT**; list caller’s rows
- PATCH `/appointments/:id/cancel` — **patient JWT**; ownership from token

### Appointments (doctor)
- GET `/appointments/doctor`
- PATCH `/appointments/:id/confirm`
- PATCH `/appointments/:id/reject`
- PATCH `/appointments/:id/cancel-as-doctor` — doctor cancels `pending` or `confirmed` on own slot

### AI recommendation
- POST `/ai/recommend-doctor`

Request:
```json
{ "symptoms": "chest pain and shortness of breath" }
```

Success:
```json
{ "recommendedSpecialty": "Cardiologist", "doctors": [{ "id": 3, "name": "Dr. Smith" }] }
```

Unknown/hallucinated specialty:
- `422 Unprocessable Entity`

AI unavailable:
- `503 Service Unavailable`

---

## Error & Observability Contract (moved earlier)

For all non-2xx responses:
```json
{ "errorCode": "SLOT_TAKEN", "message": "Slot is already booked", "requestId": "..." }
```

Also:
- **`X-Request-Id`** response header (same value as `requestId` in JSON errors) — see `src/middlewares/request-id.js`
- request ID included in logs (when logging is expanded)
- standard errorCode catalog (`AUTH_INVALID`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_TRANSITION`, etc.)

---

## AI Service Architecture

- Current implementation: **`src/services/aiRecommendation.js`** (rule-based; no external API calls)
- No appointment booking rules inside the recommendation module (only symptom → specialty → doctor list)
- Output constrained to known specialties from the DB / allow-list in code
- Injectable/mocked in tests when you add a runner
- Timeout + graceful fallback + **`ENABLE_AI_RECOMMENDATION`** — flag + rate limit implemented for the rule-based path; external provider still planned

Allowed specialties:
- General Practitioner
- Cardiologist
- Neurologist
- Dermatologist
- Orthopedist
- Pediatrician

---

## Operational Modes

### normal (main branch)
- All rules enforced

### buggy (git branch `buggy`)
- 6 intentional defects across easy / medium / hard tiers — see `BUGS.md`
- Use: `git checkout buggy && npm run db:seed && npm run dev`
- Companion test suite should produce 6 failures, all other tests green

### chaos
- `CHAOS_ENABLED` / `CHAOS_FAIL_PROBABILITY` / `CHAOS_LATENCY_MS` / `CHAOS_SEED` env vars (deterministic Mulberry32 RNG with seed)
- Random 503s and latency on all `/api/v1` routes; `/health` unaffected
- Tests in companion repo: `chaos.test.js` (skip guard; requires `CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=1`)

---

## Cross-Layer Consistency Targets

- POST `/appointments` -> visible in GET `/appointments/my`
- POST `/appointments` -> visible in GET `/appointments/doctor`
- Booked slot removed from GET `/doctors/:id/slots`
- DB status == API status
- Error responses always follow `{ errorCode, message, requestId }`

---

## Test Strategy

### Unit
- State machine transitions
- RBAC/policy checks
- AI output validator (allow-list + injection-resistance behavior)

### Integration
- Transactional booking behavior
- Repository + DB constraints
- Soft delete behavior (when enabled)

### API/E2E
- Auth and RBAC
- Booking lifecycle
- Idempotency (`409`)
- Negative transitions
- AJV schema validation for success/error payloads
- AI: success / unknown specialty (`422`) / unavailable (`503`)

### Mode-aware
- Normal mode: expected pass
- Buggy mode: explicit "expected failure demonstration" suite (separate CI job/tag)
- Chaos mode: retry/degradation tests with deterministic seed where needed

---

## Contract Source of Truth

- Official contract reference: `CONTRACT_PACK.md`
- If any rule in this plan conflicts with `CONTRACT_PACK.md`, follow `CONTRACT_PACK.md`.
- Keep endpoint RBAC/status transitions/error codes updated there first, then sync this plan.

---

## Endpoint Access & Transition Matrix

### PATCH `/appointments/:id/confirm`
- Allowed roles: `DOCTOR` (owner of slot only)
- Allowed current statuses: `PENDING`
- Success: `200`
- Anonymous: `401`
- Patient role: `403`
- Doctor not owner: `403`
- Invalid transition (`CONFIRMED|REJECTED|CANCELLED -> CONFIRMED`): `422`
- Appointment not found: `404`

### PATCH `/appointments/:id/reject`
- Allowed roles: `DOCTOR` (owner of slot only)
- Allowed current statuses: `PENDING`
- Success: `200`
- Anonymous: `401`
- Patient role: `403`
- Doctor not owner: `403`
- Invalid transition (`CONFIRMED|REJECTED|CANCELLED -> REJECTED`): `422`
- Appointment not found: `404`

### PATCH `/appointments/:id/cancel`
- Allowed roles:
  - `PATIENT` (owner of appointment only)
  - `DOCTOR` (owner of slot only)
- Allowed current statuses: `PENDING`, `CONFIRMED`
- Success: `200`
- Anonymous: `401`
- Patient cancels another patient's appointment: `403`
- Doctor cancels appointment for another doctor's slot: `403`
- Invalid transition (`REJECTED|CANCELLED -> CANCELLED`): `422`
- Appointment not found: `404`

### GET `/appointments/my`
- Allowed roles: `PATIENT`
- Success: `200` (returns only caller's appointments)
- Doctor role: `403`
- Anonymous: `401`

### GET `/appointments/doctor`
- Allowed roles: `DOCTOR`
- Success: `200` (returns only appointments on caller's slots)
- Patient role: `403`
- Anonymous: `401`

### POST `/appointments`
- Allowed roles: `PATIENT`
- Required body: `slotId`
- Success: `201` (appointment created with `PENDING`)
- Slot unavailable/already booked: `409`
- Slot not found: `404`
- Validation error: `400`
- Doctor role: `403`
- Anonymous: `401`

### Transition Rules (single source of truth)
- `PENDING -> CONFIRMED` (doctor owner)
- `PENDING -> REJECTED` (doctor owner)
- `PENDING -> CANCELLED` (patient owner or doctor owner)
- `CONFIRMED -> CANCELLED` (patient owner or doctor owner)
- Any other transition: `422`

### Error Code Catalog
- See **`CONTRACT_PACK.md`** for the live catalog (`EMAIL_TAKEN`, `EMAIL_RETIRED`, `SLOT_OVERLAP`, `SLOT_IN_USE`, etc.)
- Historical short list: `AUTH_REQUIRED` → `401`, `FORBIDDEN` → `403`, `VALIDATION_ERROR` → `400`, `SLOT_TAKEN` / slot conflicts → `409`, `INVALID_TRANSITION` → `422`

Error format:
```json
{ "errorCode": "INVALID_TRANSITION", "message": "Cannot transition from REJECTED to CONFIRMED", "requestId": "req_..." }
```

### Must-have Test Cases (Iteration 1 baseline)

**Where automated:** many rows below are covered or planned in companion **`clinic-booking-api-tests`** (`docs/RISK_ANALYSIS.md`, `TODO.md`); **double-book `409`** is covered by **`appointments.booking.conflict`**; remaining gap example: **patient cancel** — backlog there — this numbered list stays the **SUT contract checklist**, not “only manual”.

1. Patient books available slot -> `201`, status `PENDING`
2. Patient tries to book the same slot again -> `409`
3. Doctor confirms own `PENDING` appointment -> `200`
4. Doctor rejects own `PENDING` appointment -> `200`
5. Doctor confirms `REJECTED` appointment -> `422`
6. Patient cancels own `PENDING` appointment -> `200`
7. Patient cancels own `CONFIRMED` appointment -> `200`
8. Patient cancels own `REJECTED` appointment -> `422`
9. Patient calls confirm endpoint -> `403`
10. Doctor confirms appointment of another doctor -> `403`
11. `/appointments/my` returns only patient's own data
12. `/appointments/doctor` returns only doctor's own slot appointments
13. Doctor `PATCH …/cancel-as-doctor` on own `confirmed` → `200` (and frees slot)

---

## Iterations (Nothing Removed, Reordered)

### Iteration 1 — Core MVP (stabilized)
- [x] Express setup + project structure (routers + repositories; no separate service layer class tree)
- [x] SQLite schema + constraints (partial unique index for active appointments per slot; `users.email` unique)
- [x] JWT auth (register/login + **refresh** + access/refresh lifetimes via env)
- [x] Doctors + slots read flow
- [x] Slots creation via seed script **and** doctor `POST …/me/slots` (+ overlap validation)
- [x] Appointments lifecycle + state transitions (repository + routes; dedicated action endpoints)
- [x] Transaction-safe booking
- [x] Swagger / OpenAPI (`/api/docs`, `openapi/openapi.yaml`)
- [x] Unified error format + `requestId` + **`X-Request-Id`** header
- [ ] Basic **unit + integration** tests **in this repo** (deferred — `npm run lint` only for now). **Playwright API suite + CI** live in companion **`clinic-booking-api-tests`** (not counted as “missing” for this checkbox).
- [x] AI recommendation endpoint — **rule-based** implementation (`aiRecommendation.js`); external AI + test mocks still planned
- [x] Normal mode only (no buggy/chaos modes)

### Iteration 2 — QA Modes + Full Test Coverage
- [ ] Buggy mode (preset + optional per-bug flags)
- [x] Chaos mode (`CHAOS_ENABLED` / `CHAOS_FAIL_PROBABILITY` / `CHAOS_LATENCY_MS` / `CHAOS_SEED` — deterministic RNG for test reproducibility; mounted at `/api/v1`; health exposes chaos state)
- [ ] Full API/E2E breadth in **companion** test repo (expand beyond current API files; UI/e2e per `E2E_TEST_PLAN.md` §9); optional extra modes here remain future work
- [ ] Mode-aware suites (normal green, buggy demo suite isolated)
- [ ] Chaos deterministic testing with `CHAOS_SEED`

### Iteration 2.5 — Production Patterns
- [x] Rate limiting for AI endpoint (default 5 req / 60s per IP + optional `Authorization` hash)
- [x] Rate limiting for login / register / booking (`express-rate-limit`; configurable windows + max via env; `src/middlewares/rate-limit.js`)
- [x] Rich **`GET /health`** (DB + AI availability flags)
- [x] Soft delete (`deletedAt`) on **`users`** (account close demo); appointments rows use `deletedAt` column in schema but business flow is status-based
- [x] `ENABLE_AI_RECOMMENDATION` feature flag
- [x] Waiting list for booked slots (join / list / leave; no auto-book on slot free)
- [x] Auto-expire old PENDING (in-process timer via `AUTO_EXPIRE_PENDING_*` env; `0` disables)
- [x] POST **`/api/v1/debug/simulate-concurrent-booking`** (development + `ENABLE_DEBUG_ROUTES`)

### Iteration 3 — Polish + Infrastructure
- [x] README architecture
- [x] `quality-strategy.md`
- [x] GitHub Actions CI
- [x] Docker + docker-compose
- [x] Structured logging (`pino`)
- [x] GET `/metrics` (booking/cancel/confirm ratios)

### Iteration 4 — Advanced QA Patterns
- [ ] Contract testing with Pact (AI endpoint consumer contract)
- [ ] DB state assertions after API calls
- [ ] Optimistic locking via `Slot.version`
- [ ] Log assertions in tests (requestId presence, structure); optional **Grafana + Loki** during runs (see **Backlog → Logging & test observability**)

### Iteration 5 — Microservices (moved later, preserved)
- [ ] Extract `ai-service` into separate Express service
- [ ] HTTP service-to-service communication
- [ ] Integration tests across boundaries
- [ ] Independent deployment + failure isolation tests

### Iteration 6 — Kafka / Async Messaging (preserved)
- [ ] Kafka between booking service and ai-service
- [ ] Async recommendation flow
- [ ] Tests: delivery, processing, loss, duplicates/idempotency
- [ ] docker-compose with Kafka + Zookeeper

---

## Backlog (explicitly preserved, not deleted)

### Logging & test observability (planned)

- [ ] **Loki + Grafana**: collect **Pino** stdout (or file) from **runs that exercise this SUT** (including companion Playwright CI), practice LogQL / Explore, dashboards, and “logs vs `GET /metrics`” — **ingestion wiring** deferred; see **`quality-strategy.md`** for the short agreed note.

### AI Experiments

Optional **product / R&D** backlog: ideas to pursue when AI grows beyond today’s **rule-based** `POST /api/v1/ai/recommend-doctor` (`src/services/aiRecommendation.js`) — e.g. after an **external LLM** is wired behind **`ENABLE_AI_RECOMMENDATION`** and the usual timeout / validation / rate-limit story is stable. Nothing here is in-scope until a concrete story satisfies **Definition of Ready** below.

**Shipped today (context):** rule-based specialty → doctors matching; feature flag; rate limit; rich **`GET /health`** AI check; no raw-model persistence or LLM calls in-repo yet (see stack summary and **AI Service Architecture**).

- [ ] Prompt A/B strategy comparison
- [ ] Store AI raw/validated/fallback metadata
- [ ] "Why this doctor" explanation field
- [ ] Prompt-injection playground endpoint
- [ ] AI anomaly detector (high cancellation patterns)
- [ ] AI failover state (`AI_SKIPPED`)

#### Product intent — what each backlog line is for

| Backlog item | Product / QA intent |
| --- | --- |
| **Prompt A/B strategy comparison** | When prompts drive an LLM, compare strategies (quality of match, stability, cost/latency) instead of guessing one prompt — supports evidence-based tuning and portfolio narrative (“we measure, not only ship”). |
| **Store AI raw / validated / fallback metadata** | Persist or log raw model output, post-validation result, and fallback path for audit, incident review, and automation — aligns with trust, compliance posture, and debugging AI in production-like demos. |
| **“Why this doctor” explanation field** | Expose a human-readable rationale in the API (and later UI) so recommendations are **explainable** — transparency for patients/clinics and a strong interview talking point (safety + UX). |
| **Prompt-injection playground endpoint** | A deliberate **dev/demo** surface to send adversarial or edge “symptoms” and observe guardrails — security learning, regression tests for injection, without mixing that traffic into the primary user endpoint contract. |
| **AI anomaly detector (high cancellation patterns)** | Shift from “symptom → doctor” toward **operational intelligence**: flag unusual cancellation or booking patterns — product analytics / monitoring story, not core booking MVP. |
| **AI failover state (`AI_SKIPPED`)** | Make “AI did not run” a **first-class contract** (distinct from generic `503` / empty body): e.g. explicit `errorCode` or metadata when the model path is skipped by policy, quota, or outage — clearer clients and better observability. |

### Architecture Experiments
- [ ] Optional: **SPA + client-side routing** (e.g. **Vite**) for one app without full page reloads — evolution from current `public/` multi-page setup; **same REST API**; add **CORS** on Express if the UI dev server uses another origin/port.
- [ ] Internal domain events via EventEmitter
- [ ] COMPLETED appointment status
- [ ] Redis caching for doctors list
- [ ] WebSocket doctor notifications
- [ ] Admin dashboard endpoint

### Testing Experiments
- [ ] Mutation testing
- [ ] Load testing with k6
- [ ] Swagger visual diff / contract drift guard

---

## Definition of Ready (DoR)

A task/story is ready for implementation when all conditions below are met:

- Scope is explicit (endpoint/feature name, in-scope and out-of-scope notes)
- API contract is defined or referenced in `CONTRACT_PACK.md`
- RBAC and ownership rules are stated (who can do what)
- Status transition behavior is defined (including invalid transition -> `422` where applicable)
- Error responses mapped to `errorCode` + HTTP status
- Test intent listed (at least happy path + key negative paths)
- Dependencies identified (DB migration, seed updates, env flags, external service mocks)
- Acceptance criteria are measurable (observable API/DB outcomes)

If any item is missing, the task remains in refinement and is not started.

---

## Definition of Done (DoD)

### DoD — Per Task/PR

- Implementation matches agreed scope and contract (`CONTRACT_PACK.md`)
- Code includes required validation/RBAC/ownership checks
- Unit/integration/API tests added or updated for changed behavior
- Negative-path tests included for auth/authorization/invalid transitions
- OpenAPI/Swagger updated for changed endpoints/schemas/status codes
- Error responses follow `{ errorCode, message, requestId }`
- No critical lints or failing checks in changed area
- Review-ready notes included (what changed, why, how verified)

### DoD — Iteration Level

Each iteration closes only when:

- CI is green for target scope
- Contract and plan documents are synchronized (`CONTRACT_PACK.md`, `PROJECT_PLAN.md`)
- Test matrix is documented (normal/buggy/chaos expected pass/fail behavior)
- No known unresolved booking race condition in `normal` mode
- Release/readme notes updated for newly added capabilities

### DoD — Iteration 1 Exit Criteria (MVP Gate)

- Auth works for patient/doctor with **access + refresh** JWTs (`POST /auth/refresh`)
- Seed script populates doctors, patients, and usable slots
- Booking flow works transactionally (`POST /appointments`)
- Separate action endpoints work:
  - `PATCH /appointments/:id/confirm`
  - `PATCH /appointments/:id/reject`
  - `PATCH /appointments/:id/cancel` (patient)
  - `PATCH /appointments/:id/cancel-as-doctor` (doctor)
- Invalid transitions return `422` with `INVALID_TRANSITION`
- Data isolation is enforced in:
  - `GET /appointments` / `GET /appointments/my`
  - `GET /appointments/doctor`
- **Playwright baseline + CI** — **in companion repo** `clinic-booking-api-tests` (smoke gate + full `npm test` workflow). Optional: **12+ unit tests colocated in this SUT repo** — separate goal if you want pytest/node unit coverage beside Playwright.
- Swagger / OpenAPI covers MVP endpoints and major error responses (hand-maintained; drift possible)
