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
  ensureWaitlistOffersTable();
  ensureConsultationsTable();
  ensurePaymentsTable();
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

function ensureWaitlistOffersTable() {
  const t = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'waitlist_offers'").get();
  if (t) return;
  db.exec(`
    CREATE TABLE waitlist_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slotId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      existingAppointmentId INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX idx_waitlist_offers_patient ON waitlist_offers(patientId);
    CREATE INDEX idx_waitlist_offers_slot ON waitlist_offers(slotId);
  `);
}

function ensureConsultationsTable() {
  const t = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'consultations'").get();
  if (t) return;
  db.exec(`
    CREATE TABLE consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctorId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX idx_consultations_patient ON consultations(patientId);
  `);
}

function ensurePaymentsTable() {
  const t = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'payments'").get();
  if (t) return;
  db.exec(`
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultationId INTEGER,
      patientId INTEGER NOT NULL,
      paymentMethod TEXT NOT NULL,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 5000,
      idempotencyKey TEXT UNIQUE,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX idx_payments_patient ON payments(patientId);
  `);
}

module.exports = { migrate };
