require("dotenv").config();

const bcrypt = require("bcryptjs");
const { migrate } = require("../src/db/migrate");
const db = require("../src/db/connection");

migrate();

const now = new Date().toISOString();

db.exec("DELETE FROM appointments");
db.exec("DELETE FROM slot_waitlist");
db.exec("DELETE FROM slots");
db.exec("DELETE FROM doctors");
db.exec("DELETE FROM users");

const insertDoctor = db.prepare("INSERT INTO doctors (name, specialty) VALUES (?, ?)");

insertDoctor.run("John Doe", "Cardiologist");
insertDoctor.run("Jane Smith", "Dermatologist");
insertDoctor.run("Jim Beam", "Neurologist");

const row = db.prepare("SELECT id FROM doctors ORDER BY id LIMIT 1").get();
const doctorId = row.id;

const insertSlots = db.prepare(
  "INSERT INTO slots (doctorId, startTime, endTime, isAvailable) VALUES (?, ?, ?, ?)"
);

insertSlots.run(doctorId, "2026-04-21T09:00:00.000Z", "2026-04-21T10:00:00.000Z", 1);
insertSlots.run(doctorId, "2026-04-21T10:00:00.000Z", "2026-04-21T11:00:00.000Z", 1);
insertSlots.run(doctorId, "2026-04-21T11:00:00.000Z", "2026-04-21T12:00:00.000Z", 0);
insertSlots.run(doctorId, "2026-04-21T12:00:00.000Z", "2026-04-21T13:00:00.000Z", 1);
insertSlots.run(doctorId, "2026-04-21T13:00:00.000Z", "2026-04-21T14:00:00.000Z", 0);
insertSlots.run(doctorId, "2026-04-21T14:00:00.000Z", "2026-04-21T15:00:00.000Z", 1);

const passwordHash = bcrypt.hashSync("password", 10);

const insertUser = db.prepare(
  "INSERT INTO users (email, password, role, name, createdAt, updatedAt, deletedAt, doctorRecordId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

insertUser.run("admin@example.com", passwordHash, "admin", "Admin", now, now, null, null);
insertUser.run("user@example.com", passwordHash, "user", "User", now, now, null, null);
insertUser.run("doctor@example.com", passwordHash, "doctor", "Doctor", now, now, null, null);
insertUser.run("doctor2@example.com", passwordHash, "doctor", "Doctor Two", now, now, null, null);
insertUser.run("doctor3@example.com", passwordHash, "doctor", "Doctor Three", now, now, null, null);
insertUser.run("patient@example.com", passwordHash, "patient", "Patient", now, now, null, null);
insertUser.run("patient2@example.com", passwordHash, "patient", "Patient Two", now, now, null, null);
insertUser.run("reception@example.com", passwordHash, "reception", "Reception", now, now, null, null);
insertUser.run("manager@example.com", passwordHash, "manager", "Manager", now, now, null, null);

const doctorUserRow = db.prepare("SELECT id FROM users WHERE email = ?").get("doctor@example.com");
db.prepare("UPDATE users SET doctorRecordId = ? WHERE id = ?").run(doctorId, doctorUserRow.id);

const doctor2Row = db.prepare("SELECT id FROM doctors WHERE name = ?").get("Jane Smith");
const doctor2UserRow = db.prepare("SELECT id FROM users WHERE email = ?").get("doctor2@example.com");
db.prepare("UPDATE users SET doctorRecordId = ? WHERE id = ?").run(doctor2Row.id, doctor2UserRow.id);

const doctor3Row = db.prepare("SELECT id FROM doctors WHERE name = ?").get("Jim Beam");
const doctor3UserRow = db.prepare("SELECT id FROM users WHERE email = ?").get("doctor3@example.com");
db.prepare("UPDATE users SET doctorRecordId = ? WHERE id = ?").run(doctor3Row.id, doctor3UserRow.id);

const firstSlotRow = db.prepare("SELECT id FROM slots WHERE isAvailable = 1 ORDER BY id LIMIT 1").get();

console.log("Seed completed");
console.log(
  `Example booking: POST /api/v1/appointments with header Authorization: Bearer <patient JWT> and JSON body {"slotId":${firstSlotRow.id}} (patient is always the token subject)`
);
console.log(
  "Demo logins (password: password) — patient@example.com, patient2@example.com, doctor@example.com (linked to first doctor)"
);
