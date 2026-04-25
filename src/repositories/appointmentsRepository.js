const db = require("../db/connection");
const { getNextWaitlistEntry, deleteWaitlistEntryById } = require("./waitlistRepository");

/**
 * Must be called inside an existing db.transaction() — promotes the oldest
 * waitlist entry to a new pending appointment and marks the slot unavailable again.
 * No-op if the waitlist is empty for this slot.
 */
function promoteFromWaitlist(slotId, now) {
  const slot = db.prepare("SELECT doctorId FROM slots WHERE id = ?").get(slotId);
  if (!slot) return;
  const entry = getNextWaitlistEntry(slot.doctorId);
  if (!entry) return;
  db
    .prepare(
      "INSERT INTO appointments (slotId, patientId, status, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(slotId, entry.patientId, "pending", now, now, null);
  db.prepare("UPDATE slots SET isAvailable = 0 WHERE id = ?").run(slotId);
  deleteWaitlistEntryById(entry.id);
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
    if (status === "cancelled" || status === "rejected") {
      const err = new Error("Appointment cannot be cancelled from this status");
      err.status = 422;
      err.errorCode = "INVALID_TRANSITION";
      throw err;
    }
    if (status !== "pending" && status !== "confirmed") {
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
    if (status === "cancelled" || status === "rejected") {
      const err = new Error("Appointment cannot be cancelled from this status");
      err.status = 422;
      err.errorCode = "INVALID_TRANSITION";
      throw err;
    }
    if (status !== "pending" && status !== "confirmed") {
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
    if (row.status !== "pending") {
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
    if (row.status !== "pending") {
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
};
