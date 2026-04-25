const express = require("express");
const appointmentsRepository = require("../repositories/appointmentsRepository");
const waitlistRepository = require("../repositories/waitlistRepository");
const metrics = require("../metrics");
const { requireAuth, requireRoles } = require("../middlewares/auth");

const router = express.Router();

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parsePositiveIntegerParam(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

function listMyAppointments(req, res) {
  const appointments = appointmentsRepository.getAppointmentsByPatientId(req.user.id);
  res.status(200).json(appointments);
}

router.get("/", requireAuth, requireRoles("patient"), listMyAppointments);
router.get("/my", requireAuth, requireRoles("patient"), listMyAppointments);

router.get("/doctor", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const { doctorRecordId } = req.user;
  if (doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  const appointments = appointmentsRepository.getAppointmentsByDoctorId(doctorRecordId);
  res.status(200).json(appointments);
});

router.post("/waitlist", requireAuth, requireRoles("patient"), (req, res, next) => {
  const { doctorId } = req.body ?? {};
  if (!isPositiveInteger(doctorId)) {
    const err = new Error("doctorId must be a positive integer");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  try {
    const row = waitlistRepository.joinWaitlist({ doctorId, patientId: req.user.id });
    metrics.inc("waitlist_joined_total");
    req.log.info(
      { event: "waitlist.joined", waitlistId: row.id, doctorId, patientId: req.user.id },
      "patient joined doctor waitlist"
    );
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.get("/waitlist/me", requireAuth, requireRoles("patient"), (req, res) => {
  const rows = waitlistRepository.listWaitlistByPatient(req.user.id);
  res.status(200).json(rows);
});

router.delete("/waitlist/:waitlistId", requireAuth, requireRoles("patient"), (req, res, next) => {
  const entryId = parsePositiveIntegerParam(req.params.waitlistId);
  if (entryId === null) {
    const err = new Error("Invalid waitlist id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  try {
    const out = waitlistRepository.deleteWaitlistEntryForPatient({
      entryId,
      patientId: req.user.id,
    });
    metrics.inc("waitlist_removed_total");
    req.log.info(
      { event: "waitlist.removed", waitlistId: entryId, patientId: req.user.id },
      "patient left waitlist"
    );
    res.status(200).json(out);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRoles("patient"), (req, res, next) => {
  const { slotId } = req.body ?? {};
  if (!isPositiveInteger(slotId)) {
    const err = new Error("slotId must be a positive integer");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const patientId = req.user.id;
  try {
    const appointment = appointmentsRepository.bookSlot({ slotId, patientId });
    metrics.inc("appointments_booked_total");
    req.log.info(
      {
        event: "appointment.booked",
        appointmentId: appointment.id,
        slotId,
        patientId,
        status: appointment.status,
      },
      "slot booked"
    );
    res.status(201).json(appointment);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/cancel", requireAuth, requireRoles("patient"), (req, res, next) => {
  const appointmentId = parsePositiveIntegerParam(req.params.id);
  if (appointmentId === null) {
    const err = new Error("Invalid appointment id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const patientId = req.user.id;
  try {
    const updated = appointmentsRepository.cancelAppointmentByPatient({
      appointmentId,
      patientId,
    });
    metrics.inc("appointments_cancelled_by_patient_total");
    req.log.info(
      {
        event: "appointment.cancelled_by_patient",
        appointmentId,
        patientId,
        status: updated.status,
      },
      "patient cancelled appointment"
    );
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/confirm", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const appointmentId = parsePositiveIntegerParam(req.params.id);
  if (appointmentId === null) {
    const err = new Error("Invalid appointment id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (req.user.doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  try {
    const updated = appointmentsRepository.confirmAppointmentByDoctor({
      appointmentId,
      doctorRecordId: req.user.doctorRecordId,
    });
    metrics.inc("appointments_confirmed_total");
    req.log.info(
      {
        event: "appointment.confirmed",
        appointmentId,
        doctorRecordId: req.user.doctorRecordId,
        status: updated.status,
      },
      "doctor confirmed appointment"
    );
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/reject", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const appointmentId = parsePositiveIntegerParam(req.params.id);
  if (appointmentId === null) {
    const err = new Error("Invalid appointment id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (req.user.doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  try {
    const updated = appointmentsRepository.rejectAppointmentByDoctor({
      appointmentId,
      doctorRecordId: req.user.doctorRecordId,
    });
    metrics.inc("appointments_rejected_total");
    req.log.info(
      {
        event: "appointment.rejected",
        appointmentId,
        doctorRecordId: req.user.doctorRecordId,
        status: updated.status,
      },
      "doctor rejected appointment"
    );
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/cancel-as-doctor", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const appointmentId = parsePositiveIntegerParam(req.params.id);
  if (appointmentId === null) {
    const err = new Error("Invalid appointment id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (req.user.doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  try {
    const updated = appointmentsRepository.cancelAppointmentByDoctor({
      appointmentId,
      doctorRecordId: req.user.doctorRecordId,
    });
    metrics.inc("appointments_cancelled_by_doctor_total");
    req.log.info(
      {
        event: "appointment.cancelled_by_doctor",
        appointmentId,
        doctorRecordId: req.user.doctorRecordId,
        status: updated.status,
      },
      "doctor cancelled visit"
    );
    res.status(200).json(updated);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", (req, res, next) => {
  const id = parsePositiveIntegerParam(req.params.id);
  if (id === null) {
    const err = new Error("Invalid appointment id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const appointment = appointmentsRepository.getAppointmentById(id);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.status = 404;
    err.errorCode = "APPOINTMENT_NOT_FOUND";
    next(err);
    return;
  }
  res.status(200).json(appointment);
});

module.exports = router;
