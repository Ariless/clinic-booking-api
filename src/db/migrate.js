const db = require("./connection");

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY,
      doctorId INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      isAvailable INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY,
      slotId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
  `);
  ensureUsersDoctorRecordIdColumn();
  ensureAppointmentsActiveSlotUniqueIndex();
  ensureSlotWaitlistTable();
}

function ensureSlotWaitlistTable() {
  const t = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'slot_waitlist'").get();
  if (t) {
    const cols = db.prepare("PRAGMA table_info(slot_waitlist)").all();
    if (cols.some((c) => c.name === "slotId")) {
      // old per-slot schema → drop and recreate as per-doctor
      db.exec("DROP TABLE slot_waitlist");
    } else {
      return;
    }
  }
  db.exec(`
    CREATE TABLE slot_waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctorId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(doctorId, patientId)
    );
    CREATE INDEX idx_slot_waitlist_doctor ON slot_waitlist(doctorId);
    CREATE INDEX idx_slot_waitlist_patient ON slot_waitlist(patientId);
  `);
}

/** At most one pending or confirmed appointment per slot (double-booking guard at DB level). */
function ensureAppointmentsActiveSlotUniqueIndex() {
  db.exec("DROP INDEX IF EXISTS idx_appointments_one_active_per_slot");
}

function ensureUsersDoctorRecordIdColumn() {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some((c) => c.name === "doctorRecordId")) {
    db.exec("ALTER TABLE users ADD COLUMN doctorRecordId INTEGER");
  }
}

module.exports = { migrate };
