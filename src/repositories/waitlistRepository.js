const db = require("../db/connection");

/**
 * Patient joins waitlist for a slot that is currently booked (unavailable).
 * Does not auto-book when the slot frees (demo scope).
 */
function joinWaitlist({ slotId, patientId }) {
  const slot = db.prepare("SELECT * FROM slots WHERE id = ?").get(slotId);
  if (!slot) {
    const err = new Error("Slot not found");
    err.status = 404;
    err.errorCode = "SLOT_NOT_FOUND";
    throw err;
  }
  if (slot.isAvailable) {
    const err = new Error("Slot is still available; book it directly instead of joining the waitlist");
    err.status = 400;
    err.errorCode = "SLOT_STILL_AVAILABLE";
    throw err;
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ? AND deletedAt IS NULL").get(patientId);
  if (!user) {
    const err = new Error("Patient not found");
    err.status = 404;
    err.errorCode = "PATIENT_NOT_FOUND";
    throw err;
  }
  const now = new Date().toISOString();
  try {
    const info = db
      .prepare(
        "INSERT INTO slot_waitlist (slotId, patientId, createdAt) VALUES (?, ?, ?)"
      )
      .run(slotId, patientId, now);
    return db.prepare("SELECT * FROM slot_waitlist WHERE id = ?").get(info.lastInsertRowid);
  } catch (e) {
    const msg = String(e && e.message);
    if ((e && e.code === "SQLITE_CONSTRAINT_UNIQUE") || msg.includes("UNIQUE constraint failed")) {
      const err = new Error("You are already on the waitlist for this slot");
      err.status = 409;
      err.errorCode = "WAITLIST_DUPLICATE";
      throw err;
    }
    throw e;
  }
}

function listWaitlistByPatient(patientId) {
  return db
    .prepare(
      `SELECT w.*, s.startTime AS slotStartTime, s.endTime AS slotEndTime, s.doctorId
       FROM slot_waitlist w
       INNER JOIN slots s ON s.id = w.slotId
       WHERE w.patientId = ?
       ORDER BY w.createdAt ASC`
    )
    .all(patientId);
}

function deleteWaitlistEntryForPatient({ entryId, patientId }) {
  const row = db.prepare("SELECT * FROM slot_waitlist WHERE id = ?").get(entryId);
  if (!row) {
    const err = new Error("Waitlist entry not found");
    err.status = 404;
    err.errorCode = "WAITLIST_NOT_FOUND";
    throw err;
  }
  if (row.patientId !== patientId) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    throw err;
  }
  db.prepare("DELETE FROM slot_waitlist WHERE id = ?").run(entryId);
  return { id: entryId, removed: true };
}

module.exports = {
  joinWaitlist,
  listWaitlistByPatient,
  deleteWaitlistEntryForPatient,
};
