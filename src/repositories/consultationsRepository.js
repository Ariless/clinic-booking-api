const db = require("../db/connection");

function createConsultation({ doctorId, patientId }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO consultations (doctorId, patientId, status, createdAt, updatedAt)
       VALUES (?, ?, 'confirmed', ?, ?)`
    )
    .run(doctorId, patientId, now, now);
  return db.prepare("SELECT * FROM consultations WHERE id = ?").get(info.lastInsertRowid);
}

function getByPatientId(patientId) {
  return db.prepare("SELECT * FROM consultations WHERE patientId = ? ORDER BY createdAt DESC").all(patientId);
}

function getById(id) {
  return db.prepare("SELECT * FROM consultations WHERE id = ?").get(id);
}

module.exports = { createConsultation, getByPatientId, getById };
