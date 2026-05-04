// doctorRecordId → Set<WebSocket> — one doctor may have multiple browser tabs open
const doctorConnections = new Map();
// patientId → Set<WebSocket>
const patientConnections = new Map();

function add(doctorRecordId, ws) {
  if (!doctorConnections.has(doctorRecordId)) {
    doctorConnections.set(doctorRecordId, new Set());
  }
  doctorConnections.get(doctorRecordId).add(ws);
}

function remove(doctorRecordId, ws) {
  const set = doctorConnections.get(doctorRecordId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) doctorConnections.delete(doctorRecordId);
}

function get(doctorRecordId) {
  return doctorConnections.get(doctorRecordId) ?? new Set();
}

function addPatient(patientId, ws) {
  if (!patientConnections.has(patientId)) {
    patientConnections.set(patientId, new Set());
  }
  patientConnections.get(patientId).add(ws);
}

function removePatient(patientId, ws) {
  const set = patientConnections.get(patientId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) patientConnections.delete(patientId);
}

function getPatient(patientId) {
  return patientConnections.get(patientId) ?? new Set();
}

module.exports = { add, remove, get, addPatient, removePatient, getPatient };
