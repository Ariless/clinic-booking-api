# Clinic Booking API — system under test

A small **Node.js + Express** service plus a **static demo UI** (`public/`). It exists as a **controlled API designed for deterministic automation and test coverage**: predictable JSON errors, documented roles and transitions, and **stable UI hooks** (`data-qa`). Deeper logging notes and quality gates: **`quality-strategy.md`**. Automation strategy and **honest portfolio wording**: **`TESTING_AGAINST_THIS_SUT.md`** (appendix).

---

## What this system does

- **Authentication** — patient/doctor sessions, **JWT** access + refresh (demo UI **`401` → refresh → retry**: **`API_ENDPOINTS.md`** → *Behaviour notes*, **`public/js/app-core.js`**).
- **Appointment lifecycle** — book → **`pending`**; doctor confirm/reject; patient/doctor cancel per rules (**full graph:** **`CONTRACT_PACK.md`**).
- **Waitlist** — join / list / leave on **booked** slots (**no auto-book** when a slot frees). Errors: **`API_ENDPOINTS.md`**.
- **RBAC** — patient vs doctor on API and **`public/`** (guest vs signed-in behaviour: **`API_ENDPOINTS.md`**).
- **AI recommendation** — optional, rule-based; **feature-flagged**, **rate-limited**; **`422` / `503` / `429`** — **`.env.example`**.

Routes and status notes: **`API_ENDPOINTS.md`**. **`errorCode`** catalog and transitions: **`CONTRACT_PACK.md`**.

---

## Prerequisites

- **Node.js** 20+ (LTS) and **npm**
- **CI:** `npm run lint` on push/PR — `.github/workflows/ci.yml`

---

## Run locally

```bash
git clone <YOUR_REPO_URL>
cd <repo-directory>
cp .env.example .env
npm ci
npm run dev
```

- Default base URL: `http://localhost:3000` (override **`PORT`** in `.env`).
- **Migrations** run on startup. SQLite file defaults to **`./data/clinic.db`** (directory **`data/`** is gitignored).

**Optional demo data** (wipes and reseeds DB — see `scripts/seed.js`):

```bash
npm run db:seed
```

### Docker (optional)

```bash
docker compose up --build
```

Set a strong **`JWT_SECRET`** for Compose (see `docker-compose.yml`). DB persists in volume **`clinic-data`**. Use **`TRUST_PROXY=true`** behind a reverse proxy when client IP matters for rate limits.

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server with nodemon |
| `npm start` | `node src/server.js` |
| `npm run lint` | ESLint |
| `npm run db:seed` | Reset DB + demo doctors / slots / users |

---

## Automation hooks (UI)

Demo pages under **`public/`** use **`data-qa`** for stable selectors (e.g. `page-login`, `site-header`, form fields, nav links). Conventions and Playwright note: **`quality-strategy.md`** → *Demo UI — stable selectors (`data-qa`)*.

---

## Error contract (for assertions)

Non-2xx responses use one JSON shape; use **`requestId`** (and header **`X-Request-Id`**) to tie responses to logs. **This format is stable** and is the **primary assertion target** for API checks and for UI flows that surface JSON errors. **Automated API and UI suites should assert on this schema** for every non-2xx (same keys end-to-end).

```json
{
  "errorCode": "NOT_FOUND",
  "message": "Not found",
  "requestId": "<uuid>"
}
```

---

## Reference docs

These files are the **source of truth** for **contract validation** and for an **automation framework** driving this SUT.

| Doc | Use |
|-----|-----|
| **`API_ENDPOINTS.md`** | Paths, methods, bodies, notable status codes |
| **`CONTRACT_PACK.md`** | RBAC, appointment state transitions, **`errorCode`** |
| **`DEFENSE_NOTES.md`** | Request flow, security-minded notes |
| **`openapi/openapi.yaml`** + **`GET /api/docs`** | Machine-readable API |
| **`PROJECT_PLAN.md`** | Backlog and deferred ideas (e.g. richer QA modes when implemented) |
| **`quality-strategy.md`** | Lint gate, logging detail, `data-qa` rules |
| **`TESTING_AGAINST_THIS_SUT.md`** | How to exercise the API + demo UI (data, layers, limits, honest gaps) |

---

## Test & health endpoints (SUT inspection layer)

| Method | Path | Note |
|--------|------|------|
| `GET` | `/health` | DB + AI availability (`503` if DB check fails) |
| `GET` | `/metrics` | In-process counters (reset on restart) |
| `GET` | `/api/v1` | Service metadata |
| `GET` | `/api/v1/error-test` | Controlled **418** + `TEST_ERROR` through the global error handler |

Unknown routes → **404** with the same error JSON shape.

---

## Configuration

Copy **`.env.example`** → **`.env`**. Important keys: **`PORT`**, **`NODE_ENV`**, **`DATABASE_PATH`**, **`JWT_SECRET`**, **`ENABLE_AI_RECOMMENDATION`** / **`AI_RATE_LIMIT_*`**, **`AUTO_EXPIRE_PENDING_*`**, **`ENABLE_DEBUG_ROUTES`** (dev-only debug routes), **`TRUST_PROXY`**, **`LOG_LEVEL`** / **`LOG_PRETTY`**. Logging behaviour: **`quality-strategy.md`**.

---

## Layout

```text
src/           # Express app, routes, middlewares, config, services
public/        # Demo HTML + shared JS/CSS (SUT for UI checks)
scripts/       # e.g. db:seed
openapi/       # OpenAPI YAML
```

---

## Licence

ISC — see `package.json`.
