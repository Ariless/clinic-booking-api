const db = require("../db/connection");
const { getNextWaitlistEntry, deleteWaitlistEntryById } = require("./waitlistRepository");
const { isValidTransition } = require("../utils/appointmentStateMachine");

/**
 * Must be called inside an existing db.transaction() — finds the next eligible
 * waitlist patient and either promotes them directly (no active booking) or
 * creates a waitlist_offer (patient already has a booking and needs to choose).
 * No-op if the waitlist is empty or no eligible patient exists.
 */
function promoteFromWaitlist(slotId, now) {
  const slot = db.prepare("SELECT doctorId FROM slots WHERE id = ?").get(slotId);
  if (!slot) return;
  const entry = getNextWaitlistEntry(slot.doctorId, slotId);
  if (!entry) return;

  const existingAppt = db
    .prepare(
      `SELECT a.id FROM appointments a
       INNER JOIN slots s ON s.id = a.slotId
       WHERE s.doctorId = ? AND a.patientId = ? AND a.status IN ('pending', 'confirmed') AND a.deletedAt IS NULL`
    )
    .get(slot.doctorId, entry.patientId);

  if (!existingAppt) {
    // Direct promotion — patient has no conflicting booking
    db
      .prepare(
        "INSERT INTO appointments (slotId, patientId, status, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(slotId, entry.patientId, "pending", now, now, null);
    db.prepare("UPDATE slots SET isAvailable = 0 WHERE id = ?").run(slotId);
    deleteWaitlistEntryById(entry.id);
  } else {
    // Patient already has a booking — create an offer and hold the slot
    const ttlHours = parseInt(process.env.WAITLIST_OFFER_TTL_HOURS || "24", 10);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    db
      .prepare(
        `INSERT INTO waitlist_offers (slotId, patientId, existingAppointmentId, status, expiresAt, createdAt, updatedAt)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`
      )
      .run(slotId, entry.patientId, existingAppt.id, expiresAt, now, now);
    db.prepare("UPDATE slots SET isAvailable = 0 WHERE id = ?").run(slotId);
    // Waitlist entry stays until patient accepts or declines
  }
}

function bookSlot({ slotId, patientId }) {
  const run = db.transaction((sid, pid) => {
    const slot = db.prepare("SELECT * FROM slots WHERE id = ?").get(sid);
    if (!slot) {
      const err = new Error("Slot not found");
      err.status = 404;
      err.errorCode = "SLOT_NOT_FOUND";
      throw err;
    }
    if (!slot.isAvailable) {
      const err = new Error("Slot is not available");
      err.status = 409;
      err.errorCode = "SLOT_TAKEN";
      throw err;
    }
    const user = db.prepare("SELECT id FROM users WHERE id = ? AND deletedAt IS NULL").get(pid);
    if (!user) {
      const err = new Error("Patient not found");
      err.status = 404;
      err.errorCode = "PATIENT_NOT_FOUND";
      throw err;
    }
    const now = new Date().toISOString();
    const insert = db.prepare(
      "INSERT INTO appointments (slotId, patientId, status, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const info = insert.run(sid, pid, "pending", now, now, null);
    db.prepare("UPDATE slots SET isAvailable = 0 WHERE id = ?").run(sid);
    return db.prepare("SELECT * FROM appointments WHERE id = ?").get(info.lastInsertRowid);
  });
  try {
    return run(slotId, patientId);
  } catch (e) {
    const msg = String(e && e.message);
    const uniqueViolation =
      (e && e.code === "SQLITE_CONSTRAINT_UNIQUE") ||
      msg.includes("UNIQUE constraint failed") ||
      msg.includes("idx_appointments_one_active_per_slot");
    if (uniqueViolation) {
      const err = new Error("This time was just taken by another patient");
      err.status = 409;
      err.errorCode = "SLOT_TAKEN";
      throw err;
    }
    throw e;
  }
}

function getAppointmentsByPatientId(patientId) {
  return db.prepare("SELECT * FROM appointments WHERE patientId = ?").all(patientId);
}

function getAppointmentsByDoctorId(doctorId) {
  return db
    .prepare(
      `SELECT a.*, s.startTime AS slotStartTime, s.endTime AS slotEndTime
       FROM appointments a
       INNER JOIN slots s ON s.id = a.slotId
       WHERE s.doctorId = ?
       ORDER BY s.startTime DESC`
    )
    .all(doctorId);
}

function getAppointmentById(id) {
  return db.prepare("SELECT * FROM appointments WHERE id = ?").get(id);
}

function cancelAppointmentByDoctor({ appointmentId, doctorRecordId }) {
  const run = db.transaction((aid, did) => {
    const row = db
      .prepare(
        `SELECT a.*, s.doctorId AS slotDoctorId
         FROM appointments a
         INNER JOIN slots s ON s.id = a.slotId
         WHERE a.id = ?`
      )
      .get(aid);
    if (!row) {
      const err = new Error("Appointment not found");
      err.status = 404;
      err.errorCode = "APPOINTMENT_NOT_FOUND";
      throw err;
    }
    if (row.slotDoctorId !== did) {
      const err = new Error("Forbidden");
      err.status = 403;
      err.errorCode = "FORBIDDEN";
      throw err;
    }
    const { status } = row;
    if (!isValidTransition(status, "cancelled")) {
      const err = new Error("Appointment cannot be cancelled from this status");
      err.status = 422;
      err.errorCode = "INVALID_TRANSITION";
      throw err;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE appointments SET status = ?, updatedAt = ? WHERE id = ?").run("cancelled", now, aid);
    db.prepare("UPDATE slots SET isAvailable = 1 WHERE id = ?").run(row.slotId);
    promoteFromWaitlist(row.slotId, now);
    return db.prepare("SELECT * FROM appointments WHERE id = ?").get(aid);
  });
  return run(appointmentId, doctorRecordId);
}

function cancelAppointmentByPatient({ appointmentId, patientId }) {
  const run = db.transaction((aid, pid) => {
    const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(aid);
    if (!appointment) {
      const err = new Error("Appointment not found");
      err.status = 404;
      err.errorCode = "APPOINTMENT_NOT_FOUND";
      throw err;
    }
    if (appointment.patientId !== pid) {
      const err = new Error("Forbidden");
      err.status = 403;
      err.errorCode = "FORBIDDEN";
      throw err;
    }
    const { status } = appointment;
    if (!isValidTransition(status, "cancelled")) {
      const err = new Error("Appointment cannot be cancelled from this status");
      err.status = 422;
      err.errorCode = "INVALID_TRANSITION";
      throw err;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE appointments SET status = ?, updatedAt = ? WHERE id = ?").run("cancelled", now, aid);
    db.prepare("UPDATE slots SET isAvailable = 1 WHERE id = ?").run(appointment.slotId);
    promoteFromWaitlist(appointment.slotId, now);
    return db.prepare("SELECT * FROM appointments WHERE id = ?").get(aid);
  });
  return run(appointmentId, patientId);
}

function confirmAppointmentByDoctor({ appointmentId, doctorRecordId }) {
  const run = db.transaction((aid, did) => {
    const row = db
      .prepare(
        `SELECT a.*, s.doctorId AS slotDoctorId
         FROM appointments a
         INNER JOIN slots s ON s.id = a.slotId
         WHERE a.id = ?`
      )
      .get(aid);
    if (!row) {
      const err = new Error("Appointment not found");
      err.status = 404;
      err.errorCode = "APPOINTMENT_NOT_FOUND";
      throw err;
    }
    if (row.slotDoctorId !== did) {
      const err = new Error("Forbidden");
      err.status = 403;
      err.errorCode = "FORBIDDEN";
      throw err;
    }
    if (!isValidTransition(row.status, "confirmed")) {
      const err = new Error("Invalid status transition");
      err.status = 422;
      err.errorCode = "INVALID_TRANSITION";
      throw err;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE appointments SET status = ?, updatedAt = ? WHERE id = ?").run("confirmed", now, aid);
    return db.prepare("SELECT * FROM appointments WHERE id = ?").get(aid);
  });
  return run(appointmentId, doctorRecordId);
}

function rejectAppointmentByDoctor({ appointmentId, doctorRecordId }) {
  const run = db.transaction((aid, did) => {
    const row = db
      .prepare(
        `SELECT a.*, s.doctorId AS slotDoctorId
         FROM appointments a
         INNER JOIN slots s ON s.id = a.slotId
         WHERE a.id = ?`
      )
      .get(aid);
    if (!row) {
      const err = new Error("Appointment not found");
      err.status = 404;
      err.errorCode = "APPOINTMENT_NOT_FOUND";
      throw err;
    }
    if (row.slotDoctorId !== did) {
      const err = new Error("Forbidden");
      err.status = 403;
      err.errorCode = "FORBIDDEN";
      throw err;
    }
    if (!isValidTransition(row.status, "rejected")) {
      const err = new Error("Invalid status transition");
      err.status = 422;
      err.errorCode = "INVALID_TRANSITION";
      throw err;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE appointments SET status = ?, updatedAt = ? WHERE id = ?").run("rejected", now, aid);
    db.prepare("UPDATE slots SET isAvailable = 1 WHERE id = ?").run(row.slotId);
    promoteFromWaitlist(row.slotId, now);
    return db.prepare("SELECT * FROM appointments WHERE id = ?").get(aid);
  });
  return run(appointmentId, doctorRecordId);
}

/** Marks stale `pending` rows as `cancelled` and frees the slot. Used by a background timer in `server.js`. */
function expireStalePendingAppointments(maxAgeMs) {
  const cutoffMs = Date.now() - maxAgeMs;
  const cutoffIso = new Date(cutoffMs).toISOString();
  const now = new Date().toISOString();
  return db.transaction(() => {
    const rows = db
      .prepare(
        `SELECT id, slotId FROM appointments
         WHERE status = 'pending' AND createdAt < ?`
      )
      .all(cutoffIso);
    let count = 0;
    for (const row of rows) {
      db.prepare("UPDATE appointments SET status = 'cancelled', updatedAt = ? WHERE id = ?").run(now, row.id);
      db.prepare("UPDATE slots SET isAvailable = 1 WHERE id = ?").run(row.slotId);
      promoteFromWaitlist(row.slotId, now);
      count += 1;
    }
    return count;
  })();
}

module.exports = {
  bookSlot,
  cancelAppointmentByPatient,
  cancelAppointmentByDoctor,
  confirmAppointmentByDoctor,
  rejectAppointmentByDoctor,
  getAppointmentsByPatientId,
  getAppointmentsByDoctorId,
  getAppointmentById,
  expireStalePendingAppointments,
  promoteFromWaitlist,
};
