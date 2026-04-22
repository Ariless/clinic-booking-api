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
    return;
  }
  db.exec(`
    CREATE TABLE slot_waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slotId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(slotId, patientId)
    );
    CREATE INDEX idx_slot_waitlist_slot ON slot_waitlist(slotId);
    CREATE INDEX idx_slot_waitlist_patient ON slot_waitlist(patientId);
  `);
}

/** At most one pending or confirmed appointment per slot (double-booking guard at DB level). */
function ensureAppointmentsActiveSlotUniqueIndex() {
  const idx = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_appointments_one_active_per_slot'")
    .get();
  if (idx) {
    return;
  }
  db.exec(`
    CREATE UNIQUE INDEX idx_appointments_one_active_per_slot
    ON appointments(slotId)
    WHERE status IN ('pending', 'confirmed')
  `);
}

function ensureUsersDoctorRecordIdColumn() {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some((c) => c.name === "doctorRecordId")) {
    db.exec("ALTER TABLE users ADD COLUMN doctorRecordId INTEGER");
  }
}

module.exports = { migrate };
