# clinic-booking-api — Contract Pack

Use this file as the API contract source of truth for status handling, RBAC behavior, and error responses.

---

## Global Error Contract

All non-2xx responses must use this shape:

```json
{
  "errorCode": "INVALID_TRANSITION",
  "message": "Cannot transition from REJECTED to CONFIRMED",
  "requestId": "req_123abc"
}
```

Tracing:
- Every error JSON body includes **`requestId`** (see `error-handler`).
- The same id is sent on every response as the **`X-Request-Id`** header (set in `request-id` middleware).

---

## Error Code Catalog

- `AUTH_REQUIRED` -> `401`
- `FORBIDDEN` -> `403`
- `VALIDATION_ERROR` -> `400`
- `EMAIL_TAKEN` -> `409` (register: email already used by an **active** user)
- `EMAIL_RETIRED` -> `409` (register: email exists only on a **soft-deleted** row; cannot insert again because of DB `UNIQUE` on email)
- `APPOINTMENT_NOT_FOUND` -> `404`
- `SLOT_NOT_FOUND` -> `404`
- `SLOT_TAKEN` -> `409`
- `SLOT_IN_USE` -> `409` (slot cannot be deleted while a **pending** or **confirmed** appointment exists on it)
- `SLOT_OVERLAP` -> `409` (new diary opening overlaps another slot for the **same** doctor; other doctors may overlap)
- `INVALID_TRANSITION` -> `422`
- `INTERNAL_ERROR` -> `500`

Notes:
- **`POST /api/v1/auth/register`** — rejects invalid payloads (`400 VALIDATION_ERROR`): email format/length, password length 6–72 UTF-8 bytes, name length, invalid `role`. Returns `409 EMAIL_TAKEN` if an **active** user already has that email (case-insensitive), or `409 EMAIL_RETIRED` if the email exists only on a **soft-deleted** row (DB unique constraint; cannot reuse in this demo).
- Invalid appointment status changes always return `422`.
- Authorization failures return `401` (no/invalid token) or `403` (token valid, action forbidden).

---

## Status Transition Matrix

Allowed (status strings in API/DB are **lowercase**):
- `pending -> confirmed` (doctor who owns slot)
- `pending -> rejected` (doctor who owns slot)
- `pending -> cancelled` (**patient** who owns appointment, or **doctor** who owns the slot via `PATCH …/cancel-as-doctor`)
- `confirmed -> cancelled` (patient who owns appointment, or **doctor** who owns the slot via `PATCH …/cancel-as-doctor`)

Disallowed:
- `confirmed -> confirmed`
- `rejected -> *`
- `cancelled -> *`
- Any unspecified transition

For every disallowed transition:
- HTTP status: `422`
- `errorCode`: `INVALID_TRANSITION`

---

## Endpoint Contract Rules

### `POST /api/v1/appointments`
- Role: **patient** JWT only
- Body: **`{ slotId }`** only (positive integer); patient id is always **`req.user.id`**
- Success: `201` with created appointment (`pending`)
- `409 SLOT_TAKEN` when slot unavailable/already booked
- `404 SLOT_NOT_FOUND` when slot does not exist
- `404 PATIENT_NOT_FOUND` when patient user missing/deleted
- `400 VALIDATION_ERROR` on invalid body
- `401 AUTH_REQUIRED` if unauthenticated
- `403 FORBIDDEN` if role is not patient

### `GET /api/v1/appointments` and `GET /api/v1/appointments/my`
- Role: **patient** JWT only
- Success: `200` with only caller's appointments (same handler semantics)
- `401 AUTH_REQUIRED` if unauthenticated
- `403 FORBIDDEN` for doctor role

### `GET /api/v1/appointments/doctor`
- Role: **doctor** JWT with linked **`doctorRecordId`**
- Success: `200` with only appointments on caller's slots
- `401 AUTH_REQUIRED` if unauthenticated
- `403 FORBIDDEN` for patient role or unlinked doctor profile

### `POST /api/v1/doctors/me/slots` and `POST /api/v1/doctors/:id/slots`
- Role: **doctor** JWT with linked **`doctorRecordId`** (path variant requires `:id` === that id)
- Body: **`{ startTime, endTime, isAvailable? }`** (ISO datetimes; `endTime` after `startTime`)
- Success: `201`
- `409 SLOT_OVERLAP` when the interval overlaps any existing slot for **that** doctor (half-open `[start,end)` — adjacent slots with `end === next start` are allowed)
- `400 VALIDATION_ERROR` / `404 DOCTOR_NOT_FOUND` / `403 FORBIDDEN` as applicable

### `DELETE /api/v1/doctors/me/slots/:slotId`
- Role: **doctor** JWT with linked profile
- Success: `204` when slot owned by doctor and there is **no pending or confirmed** appointment on that slot (older cancelled/rejected rows are deleted with the slot)
- `409 SLOT_IN_USE` when a **pending** or **confirmed** appointment exists for that slot
- `404 SLOT_NOT_FOUND` / `403 FORBIDDEN` as applicable

### `PATCH /api/v1/appointments/:id/confirm`
- Role: **doctor** JWT (must own slot via `doctorRecordId`)
- Allowed source status: **`pending`**
- Success: `200`
- `404 APPOINTMENT_NOT_FOUND` when id missing
- `403 FORBIDDEN` for non-owner doctor or patient role
- `401 AUTH_REQUIRED` if unauthenticated
- `422 INVALID_TRANSITION` for any non-`pending` source status

### `PATCH /api/v1/appointments/:id/reject`
- Role: **doctor** JWT (must own slot via `doctorRecordId`)
- Allowed source status: **`pending`**
- Success: `200`
- `404 APPOINTMENT_NOT_FOUND` when id missing
- `403 FORBIDDEN` for non-owner doctor or patient role
- `401 AUTH_REQUIRED` if unauthenticated
- `422 INVALID_TRANSITION` for any non-`pending` source status

### `PATCH /api/v1/appointments/:id/cancel`
- Role: **patient** JWT only (must own appointment); **`patientId`** is taken from **`req.user.id`** (request body ignored)
- Allowed source statuses: `pending`, `confirmed` (implementation uses lowercase strings)
- Success: `200`
- `404 APPOINTMENT_NOT_FOUND` when id missing
- `401 AUTH_REQUIRED` if unauthenticated
- `403 FORBIDDEN` if appointment not owned by caller
- `422 INVALID_TRANSITION` from `rejected` or `cancelled` (and other invalid sources)

### `PATCH /api/v1/appointments/:id/cancel-as-doctor`
- Role: **doctor** JWT (must own slot via `doctorRecordId`)
- Allowed source statuses: **`pending`**, **`confirmed`** → `cancelled`; frees the slot (`isAvailable = 1`)
- Success: `200`
- Same `404` / `403` / `422` patterns as other doctor appointment actions

---

## Contract-Level Test Checklist

1. Booking available slot returns `201` and `pending`
2. Double booking returns `409 SLOT_TAKEN` (app logic or DB partial unique index on active statuses per `slotId`)
3. Doctor confirms own `pending` appointment (`200`)
4. Doctor rejects own `pending` appointment (`200`)
5. Confirm on `rejected` returns `422 INVALID_TRANSITION`
6. Patient cancels own `pending` (`200`)
7. Patient cancels own `confirmed` (`200`)
8. Cancel on `rejected` returns `422 INVALID_TRANSITION`
9. Patient cannot call confirm/reject (`403`)
10. Doctor cannot act on another doctor's appointment (`403`)
11. `/appointments/my` returns only patient-owned rows
12. `/appointments/doctor` returns only doctor-owned rows
13. Doctor cancels own `confirmed` visit via `cancel-as-doctor` (`200`)

---

## Iteration Scope Notes

- Iteration 1-2: keep separate action endpoints (`/confirm`, `/reject`, `/cancel`).
- Iteration 3+ (optional): add `PATCH /appointments/:id/status` as advanced API.
- If unified status endpoint is added later, keep existing endpoints as compatibility aliases.
