const db = require("../db/connection");

function getByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? AND deletedAt IS NULL").get(email);
}

/** Row for this email regardless of soft-delete (for registration / uniqueness checks). */
function getByEmailAnyStatus(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function getById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ? AND deletedAt IS NULL").get(id);
}

function getPublicById(id) {
  return db
    .prepare(
      `SELECT id, email, role, name, doctorRecordId, createdAt, updatedAt, deletedAt
       FROM users WHERE id = ? AND deletedAt IS NULL`
    )
    .get(id);
}

function createUser({ email, passwordHash, name, role, doctorRecordId }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (email, password, role, name, createdAt, updatedAt, deletedAt, doctorRecordId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(email, passwordHash, role, name, now, now, null, doctorRecordId ?? null);
  return getPublicById(info.lastInsertRowid);
}

function softDeleteUser(id) {
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL").run(now, now, id);
}

module.exports = {
  getByEmail,
  getByEmailAnyStatus,
  getById,
  getPublicById,
  createUser,
  softDeleteUser,
};
