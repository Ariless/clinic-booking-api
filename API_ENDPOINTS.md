# API endpoints — learning project

Single place for **implemented** routes. OpenAPI: **`openapi/openapi.yaml`**, UI: **`GET /api/docs`**, raw: **`GET /api/openapi.yaml`**.

Base: `http://localhost:3000` (see `PORT` in `.env`). Versioned API: **`/api/v1`**.

**Auth:** `POST …/auth/register` and `POST …/auth/login` return **`{ token, refreshToken, user }`**. **`POST …/auth/refresh`** accepts **`{ refreshToken }`** and returns a new pair. Protected routes: header **`Authorization: Bearer <token>`** (access JWT only; refresh tokens are rejected here).

**Demo seed:** `npm run db:seed` — passwords **`password`** for seeded users. **Doctors** (each has `doctorRecordId` to a directory row; use any for slot-creation tests): **`doctor@example.com`** → Anna Volkova (cardiology), **`doctor2@example.com`** → Marcus Chen (dermatology), **`doctor3@example.com`** → Sophie Dubois (neurology). **Patients:** **`patient@example.com`**, **`patient2@example.com`** (concurrency demos). Demo slots start on the **first** doctor only.

---

## Implemented

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/` | — | Demo UI (`index.html`); other HTML under `/patient/…`, `/doctor/…`, `/login`, `/register*` |
| `GET` | `/health` | — | Readiness-style JSON: `status` (`ok` \| `degraded`), `checks.database`, `checks.ai`; **`503`** if database check fails |
| `GET` | `/metrics` | — | In-memory counters (`appointments_*`, `waitlist_*`) and simple **ratios** (reset on restart) |
| `GET` | `/api/v1` | — | Service metadata |
| `GET` | `/api/v1/error-test` | — | Pipeline error test (`418`) |
| `POST` | `/api/v1/auth/register` | — | Register `{ email, password, name, role?, doctorRecordId? }` → `201` + JWTs. `400` if email/password/name/role invalid (password 6–72 UTF-8 bytes, name up to 120 chars, email up to 254 chars and valid shape, `role` only patient or doctor). `409` `EMAIL_TAKEN` if an **active** user has that email; `409` `EMAIL_RETIRED` if email exists only on a **closed** account (demo DB cannot reuse) |
| `POST` | `/api/v1/auth/login` | — | `{ email, password }` → `200` + access + refresh JWTs |
| `POST` | `/api/v1/auth/refresh` | — | `{ refreshToken }` → `200` + new **`token`**, **`refreshToken`**, **`user`** |
| `GET` | `/api/v1/auth/me` | JWT | `{ user, doctorProfile }` — `doctorProfile` for doctors linked to directory |
| `DELETE` | `/api/v1/auth/me` | JWT | Soft-delete **patient** or **doctor** account → `204` |
| `POST` | `/api/v1/ai/recommend-doctor` | — | `{ symptoms }` → specialty + doctors; `422` if unknown specialty; **`503`** `FEATURE_DISABLED` if `ENABLE_AI_RECOMMENDATION=false`; **`429`** `RATE_LIMITED` (default **5**/window/IP+token hash; see env) |
| `GET` | `/api/v1/doctors` | — | List doctors (directory) |
| `GET` | `/api/v1/doctors/:id` | — | One doctor |
| `GET` | `/api/v1/doctors/:id/slots` | — | **Available** slots only (patient / public booking) |
| `GET` | `/api/v1/doctors/me/slots` | Doctor JWT + `doctorRecordId` | All slots for linked directory row (available + booked) |
| `POST` | `/api/v1/doctors/me/slots` | Doctor JWT + `doctorRecordId` | Create slot `{ startTime, endTime, isAvailable? }` → `201`; `409` `SLOT_OVERLAP` if the interval overlaps another slot **for this doctor** (other doctors may use the same wall-clock window) |
| `DELETE` | `/api/v1/doctors/me/slots/:slotId` | Doctor JWT + `doctorRecordId` | Delete slot if it belongs to this doctor and there is **no pending or confirmed** appointment on it → `204` (clears cancelled/rejected history rows); `409` `SLOT_IN_USE` if an active visit exists |
| `POST` | `/api/v1/doctors/:id/slots` | Doctor JWT, **`:id` === `doctorRecordId`** | Same create as `/me/slots` (including `SLOT_OVERLAP` rule) → `201` |
| `GET` | `/api/v1/appointments` | **Patient JWT** | Same as `/my`: list **`req.user.id`** appointments |
| `GET` | `/api/v1/appointments/my` | **Patient JWT** | List caller’s appointments |
| `GET` | `/api/v1/appointments/doctor` | **Doctor JWT** + linked profile | Appointments on doctor’s slots |
| `POST` | `/api/v1/appointments/waitlist` | **Patient JWT** | Join waitlist for a **doctor**: `{ doctorId }` → `201`. One entry per patient+doctor; `409` `WAITLIST_DUPLICATE` if already queued. When any slot frees, oldest entry is **auto-promoted** to a new `pending` appointment. |
| `GET` | `/api/v1/appointments/waitlist/me` | **Patient JWT** | List caller’s waitlist entries (with `doctorName`, `doctorSpecialty`) |
| `DELETE` | `/api/v1/appointments/waitlist/:waitlistId` | **Patient JWT** | Remove own waitlist entry → `200` `{ id, removed }` |
| `GET` | `/api/v1/doctors/me/waitlist` | **Doctor JWT** + linked profile | List patients waiting for an earlier slot with this doctor (with `patientName`, `patientEmail`) |
| `POST` | `/api/v1/appointments` | **Patient JWT** | Book **`{ slotId }`** only; patient is **`req.user.id`** → `201` |
| `PATCH` | `/api/v1/appointments/:id/cancel` | **Patient JWT** | Cancel if caller owns row; body **not** required (`patientId` from JWT) → `200` |
| `PATCH` | `/api/v1/appointments/:id/confirm` | Doctor JWT | `pending` → `confirmed` |
| `PATCH` | `/api/v1/appointments/:id/reject` | Doctor JWT | `pending` → `rejected`; frees slot |
| `PATCH` | `/api/v1/appointments/:id/cancel-as-doctor` | Doctor JWT | Doctor cancels **`pending`** or **`confirmed`** visit on own slot → `cancelled`; frees slot |
| `GET` | `/api/v1/appointments/:id` | — | One appointment by id |
| `POST` | `/api/v1/debug/simulate-concurrent-booking` | — | **Dev only:** `ENABLE_DEBUG_ROUTES=true` and `NODE_ENV=development`. Body `{ slotId, patientId1, patientId2 }` — two sequential `bookSlot` attempts (second should fail with `SLOT_TAKEN` if first wins). For real HTTP overlap use parallel clients. |

---

## Behaviour notes (UI + security)

- **Guests** cannot use `/doctor` HTML pages (redirect to login); **patient** booking UI lets guests **browse** slots; **saving** a booking requires a **patient** JWT.
- **`ClinicApp.api`** merges `Authorization` with any custom `Content-Type` body headers (see `public/js/app-core.js`). On **`401`**, it attempts **`POST /auth/refresh`** once using the stored refresh token, then retries the request.

---

## Deferred (not in this codebase yet)

| Area | Notes |
|------|--------|
| **Automated tests** | Planned later (`PROJECT_PLAN.md`): Supertest / Playwright when you lock flows. |
| **Chaos mode** | Planned — random latency + 500 injection (`PROJECT_PLAN.md`). |
| **Buggy branch** | `git checkout buggy` — 6 intentional defects for test suite validation (`BUGS.md`). |
| **External AI provider** | Anthropic etc. — current `/ai/recommend-doctor` is **rule-based**; `ENABLE_AI_RECOMMENDATION` toggles the endpoint. |
| **Waitlist → auto-book** | Waitlist rows are stored; automatic promotion when a slot frees is **not** implemented. |

---

## Config (`src/config/env.js`)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` \| `test` \| `production` |
| `DATABASE_PATH` | Relative SQLite path (e.g. `./data/clinic.db`) |
| `JWT_SECRET` | Required in **production**; dev fallback if unset |
| `JWT_EXPIRES_IN` | Access token lifetime (default `1h`; string for `jsonwebtoken`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (default `7d`) |
| `LOG_LEVEL` | Pino log level: `trace` … `fatal` (default `info`) |
| `LOG_PRETTY` | `true` / `false` — human-readable dev logs via `pino-pretty` (default `false`) |
| `ENABLE_AI_RECOMMENDATION` | `true` / `false` — AI POST enabled (default `true`) |
| `AI_RATE_LIMIT_WINDOW_MS` | AI throttle window in ms (default `60000`) |
| `AI_RATE_LIMIT_MAX` | Max AI POSTs per window per client key (default `5`) |
| `TRUST_PROXY` | `true` / `false` — Express `trust proxy` for correct `req.ip` behind a proxy |
| `AUTO_EXPIRE_PENDING_INTERVAL_MS` | If `> 0`, interval to cancel stale **`pending`** rows and free slots (default `0` = off) |
| `AUTO_EXPIRE_PENDING_MAX_AGE_MS` | Age threshold for expiring `pending` (default 7 days) |
| `ENABLE_DEBUG_ROUTES` | `true` / `false` — mount debug routes in **development** only (default `false`) |

See **`.env.example`**. Logging: **`README.md` → Logging (observability)**. Quality gates: **`quality-strategy.md`**.
