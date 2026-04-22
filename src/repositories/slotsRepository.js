const db = require("../db/connection");

function getAvailableByDoctorId(doctorId) {
  return db.prepare("SELECT id, doctorId, startTime, endTime, isAvailable FROM slots WHERE doctorId = ? AND isAvailable = 1 ORDER BY startTime ASC").all(Number(doctorId));
}

function getSlotsByDoctorId(doctorId) {
  return db
    .prepare(
      "SELECT id, doctorId, startTime, endTime, isAvailable FROM slots WHERE doctorId = ? ORDER BY startTime ASC"
    )
    .all(Number(doctorId));
}

/**
 * Half-open overlap [start, end): overlaps iff existing.start < newEnd && newStart < existing.end.
 * Same instant at boundary (new start === existing end) is allowed.
 */
function hasOverlappingSlot({ doctorId, startTime, endTime }) {
  const row = db
    .prepare(
      `SELECT 1 AS x FROM slots
       WHERE doctorId = ?
         AND startTime < ?
         AND ? < endTime
       LIMIT 1`
    )
    .get(Number(doctorId), endTime, startTime);
  return Boolean(row);
}

function insertSlot({ doctorId, startTime, endTime, isAvailable }) {
  if (hasOverlappingSlot({ doctorId, startTime, endTime })) {
    const err = new Error("This opening overlaps another time in your diary");
    err.status = 409;
    err.errorCode = "SLOT_OVERLAP";
    throw err;
  }
  const avail = isAvailable === false ? 0 : 1;
  const info = db
    .prepare("INSERT INTO slots (doctorId, startTime, endTime, isAvailable) VALUES (?, ?, ?, ?)")
    .run(Number(doctorId), startTime, endTime, avail);
  return db.prepare("SELECT id, doctorId, startTime, endTime, isAvailable FROM slots WHERE id = ?").get(info.lastInsertRowid);
}

/**
 * Remove a diary row only if it belongs to this doctor and no appointments reference it.
 * @param {{ doctorId: number, slotId: number }} p
 */
function deleteOwnedSlotIfUnused(p) {
  const slotId = Number(p.slotId);
  const doctorId = Number(p.doctorId);
  const slot = db.prepare("SELECT * FROM slots WHERE id = ?").get(slotId);
  if (!slot) {
    const err = new Error("Slot not found");
    err.status = 404;
    err.errorCode = "SLOT_NOT_FOUND";
    throw err;
  }
  if (Number(slot.doctorId) !== doctorId) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    throw err;
  }
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM appointments WHERE slotId = ? AND status IN ('pending', 'confirmed')"
    )
    .get(slotId);
  if (row && Number(row.c) > 0) {
    const err = new Error("This time still has an active visit and cannot be removed from the diary.");
    err.status = 409;
    err.errorCode = "SLOT_IN_USE";
    throw err;
  }
  const run = db.transaction(() => {
    db.prepare("DELETE FROM appointments WHERE slotId = ?").run(slotId);
    db.prepare("DELETE FROM slots WHERE id = ?").run(slotId);
  });
  run();
}

module.exports = {
  getAvailableByDoctorId,
  getSlotsByDoctorId,
  insertSlot,
  deleteOwnedSlotIfUnused,
};