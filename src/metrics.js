/** In-process counters for demos and dashboards (not persisted across restarts). */

const counters = {
  appointments_booked_total: 0,
  appointments_confirmed_total: 0,
  appointments_rejected_total: 0,
  appointments_cancelled_by_patient_total: 0,
  appointments_cancelled_by_doctor_total: 0,
  appointments_pending_expired_total: 0,
  waitlist_joined_total: 0,
  waitlist_removed_total: 0,
};

function inc(name, delta = 1) {
  if (!Object.prototype.hasOwnProperty.call(counters, name)) {
    counters[name] = 0;
  }
  counters[name] += delta;
}

function snapshot() {
  const c = { ...counters };
  const booked = c.appointments_booked_total || 0;
  const ratios = {
    confirmed_to_booked: booked > 0 ? c.appointments_confirmed_total / booked : null,
    rejected_to_booked: booked > 0 ? c.appointments_rejected_total / booked : null,
    patient_cancel_to_booked: booked > 0 ? c.appointments_cancelled_by_patient_total / booked : null,
    doctor_cancel_to_booked: booked > 0 ? c.appointments_cancelled_by_doctor_total / booked : null,
  };
  return { counters: c, ratios };
}

module.exports = { inc, snapshot };
