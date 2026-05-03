const db = require("../db/connection");

function findByIdempotencyKey(idempotencyKey, patientId) {
  return db
    .prepare("SELECT * FROM payments WHERE idempotencyKey = ? AND patientId = ?")
    .get(idempotencyKey, patientId);
}

function createPayment({ consultationId, patientId, paymentMethod, status, amount, idempotencyKey }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO payments (consultationId, patientId, paymentMethod, status, amount, idempotencyKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(consultationId ?? null, patientId, paymentMethod, status, amount, idempotencyKey ?? null, now);
  return db.prepare("SELECT * FROM payments WHERE id = ?").get(info.lastInsertRowid);
}

module.exports = { findByIdempotencyKey, createPayment };
