# Known bugs — `buggy` branch

This branch contains **6 intentional bugs** at three difficulty levels. Use this branch to verify that your test suite catches regressions.

Run the companion test suite against this server — all affected tests should fail.

---

## Easy (status code / validation)

### B1 — Wrong status code on booking
**Symptom:** `POST /api/v1/appointments` returns `200` instead of `201`.  
**Caught by:** `appointments.mini.j1.test.js`

### B2 — Password validation too weak
**Symptom:** `POST /api/v1/auth/register` accepts passwords shorter than 6 characters (accepts any non-empty string).  
**Caught by:** `auth.register.test.js`

---

## Medium (state machine / invariants)

### B3 — Slot not freed after reject
**Symptom:** When a doctor rejects an appointment, the slot stays `isAvailable = 0`. No other patient can book it.  
**Caught by:** `appointments.reject.j2.test.js`

### B4 — Cross-doctor RBAC missing on confirm
**Symptom:** A doctor can confirm appointments belonging to another doctor's slots. Ownership check removed.  
**Caught by:** `appointments.rbac.cross-doctor.test.js`

---

## Hard (security / concurrency)

### B5 — Patient can read doctor appointments list
**Symptom:** `GET /api/v1/appointments/doctor` does not check role — a patient token gets `200` instead of `403`.  
**Caught by:** `appointments.rbac.doctor.test.js` (`@smoke`)

### B6 — Double booking possible
**Symptom:** Two patients can book the same slot simultaneously. The `isAvailable` check is bypassed and the DB-level unique index is dropped on server start.  
**Caught by:** `appointments.booking.conflict.test.js`

---

## How to use

```bash
# In SUT repo
git checkout buggy
npm run db:seed
npm run dev

# In test repo
npm test
# or smoke only:
npm run test:smoke
```

Expected result: **B1, B2, B3, B4, B5, B6** tests fail. All other tests remain green.
