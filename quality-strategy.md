# Quality strategy — clinic-booking-api-learning

Start with **`README.md`** for a minimal *system-under-test* view (how to run, domain summary, `data-qa` pointers, error JSON, and links to contracts). **This document** goes deeper: quality gates today, logging and observability, **`data-qa`** naming rules, and automation that is intentionally still deferred.

## Current gates

- **ESLint** (`npm run lint`) — static analysis on application and shared browser scripts under `public/js/`. CI runs the same command on push and pull requests (see `.github/workflows/ci.yml`).
- **Fail-fast config** — invalid `NODE_ENV`, relative `DATABASE_PATH`, and production `JWT_SECRET` are validated at startup (`src/config/env.js`).
- **Contract documentation** — `API_ENDPOINTS.md`, `CONTRACT_PACK.md`, `openapi/openapi.yaml`, and `GET /api/docs` are maintained alongside behaviour changes.

## Demo UI — stable selectors (`data-qa`)

The static demo under `public/*.html` is the surface future **Playwright** (or similar) flows will drive. **One agreed attribute:** **`data-qa`** — use it for automation hooks; do **not** introduce parallel **`data-testid`** on new markup unless an external tool cannot be configured otherwise.

**Naming (kebab-case, ASCII):**

| Scope | Pattern | Examples |
| --- | --- | --- |
| Page | `page-{slug}` on `<body>` | `page-home`, `page-login`, `page-patient-booking` |
| Global chrome | `site-*` | `site-header`, `site-login`, `site-logout` |
| Workspace nav | `patient-nav-*`, `doctor-nav-*` | `patient-nav-booking`, `doctor-nav-schedule` |
| Screen sections and controls | `{area}-{…}` with a clear role suffix | `login-form`, `login-submit`, `doctor-schedule-create-form`, `patient-appt-list` |

**Dynamic markup:** controls built in inline `<script>` (list actions, rows) must set **`data-qa`** when the node is created, using the same rules.

**Playwright:** set `testIdAttribute: 'data-qa'` (project `use` or config) so `page.getByTestId('login-submit')` resolves to `[data-qa="login-submit"]`.

**Legacy note:** `patient-schedule.html` still uses shortened **`schedule-*`** on some inner controls; new hooks on that page should prefer **`patient-schedule-*`** (and older `schedule-*` ids can be migrated when touched).

## Deferred (by design)

- **Automated API / E2E tests** — not wired yet; the goal is to add **Playwright** and targeted API checks once flows are stable enough that tests are explanatory rather than noise. Until then, manual exploratory testing and lint are the primary gates.
- **Chaos mode** — implemented in `src/middlewares/chaos.js` (env-controlled fault injection; see **`README.md`** → *Configuration*). Companion framework tests in `chaos.test.js`.
- **Load / mutation testing** — out of scope for this learning repository unless explicitly added later.

## Operational checks (manual)

- **`GET /health`** — confirms database connectivity and reports AI feature availability.
- **`GET /metrics`** — in-process counters for booking lifecycle events (resets on restart); useful for demos and for relating **logs vs metrics**.

## Logging

**Current (in this repo):** the API uses **Pino** (`src/logger.js`) and **pino-http** for structured JSON logs (one object per line), with **`X-Request-Id` / `requestId`** correlation and redaction of **`Authorization`** / **`Cookie`**. Domain handlers use stable **`event`** fields where it helps investigations. For SUT readers, **`README.md`** covers the HTTP **error contract**; this *Logging* section is the deeper note.

**Planned (not implemented in the project yet):** when automated tests (**Playwright** + API checks) are added, the intention is to combine that layer with **Grafana + Loki** — ship or scrape the same JSON log lines into Loki, explore and filter them in Grafana (timestamps, `level`, `requestId`, `event`), and use that stack for learning and demos (incident-style queries, “logs vs metrics”). No Docker Compose / Promtail / Loki wiring is committed until that work starts; this paragraph is only the agreed direction.
