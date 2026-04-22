const db = require("../db/connection");

function getAll() {
  return db.prepare("SELECT id, name, specialty FROM doctors ORDER BY id").all();
}

function getById(id) {
  return db.prepare("SELECT id, name, specialty FROM doctors WHERE id = ?").get(Number(id));
}

function getBySpecialty(specialty) {
  return db
    .prepare("SELECT id, name, specialty FROM doctors WHERE specialty = ? ORDER BY id")
    .all(specialty);
}

function create(doctor) {
  return db
    .prepare("INSERT INTO doctors (name, specialty) VALUES (?, ?)")
    .run(doctor.name, doctor.specialty);
}

function update(id, doctor) {
  return db
    .prepare("UPDATE doctors SET name = ?, specialty = ? WHERE id = ?")
    .run(doctor.name, doctor.specialty, Number(id));
}

function remove(id) {
  return db.prepare("DELETE FROM doctors WHERE id = ?").run(Number(id));
}

module.exports = {
  getAll,
  getById,
  getBySpecialty,
  create,
  update,
  remove,
};
