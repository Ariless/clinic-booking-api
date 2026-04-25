const express = require("express");
const doctorsRepository = require("../repositories/doctorsRepository");
const slotsRepository = require("../repositories/slotsRepository");
const waitlistRepository = require("../repositories/waitlistRepository");
const { requireAuth, requireRoles } = require("../middlewares/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const doctors = doctorsRepository.getAll();
  res.status(200).json(doctors);
});

router.get("/me/waitlist", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const doctorRecordId = req.user.doctorRecordId;
  if (doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  try {
    const rows = waitlistRepository.listWaitlistByDoctor(doctorRecordId);
    res.status(200).json(rows);
  } catch (e) {
    next(e);
  }
});

router.get("/me/slots", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const doctorRecordId = req.user.doctorRecordId;
  if (doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  const slots = slotsRepository.getSlotsByDoctorId(doctorRecordId);
  res.status(200).json(slots);
});

router.post("/me/slots", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const doctorRecordId = req.user.doctorRecordId;
  if (doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  const { startTime, endTime, isAvailable } = req.body ?? {};
  if (typeof startTime !== "string" || !startTime.trim() || typeof endTime !== "string" || !endTime.trim()) {
    const err = new Error("startTime and endTime are required ISO strings");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const startMs = Date.parse(startTime.trim());
  const endMs = Date.parse(endTime.trim());
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    const err = new Error("startTime and endTime must be valid datetimes");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (endMs <= startMs) {
    const err = new Error("endTime must be after startTime");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (!doctorsRepository.getById(doctorRecordId)) {
    const err = new Error("Doctor not found");
    err.status = 404;
    err.errorCode = "DOCTOR_NOT_FOUND";
    next(err);
    return;
  }
  try {
    const slot = slotsRepository.insertSlot({
      doctorId: Number(doctorRecordId),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      isAvailable: isAvailable !== false,
    });
    res.status(201).json(slot);
  } catch (e) {
    next(e);
  }
});

router.delete("/me/slots/:slotId", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const doctorRecordId = req.user.doctorRecordId;
  if (doctorRecordId == null) {
    const err = new Error("Doctor profile is not linked to this account");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  const raw = req.params.slotId;
  const slotId = Number(raw);
  if (!Number.isInteger(slotId) || slotId < 1) {
    const err = new Error("Invalid slot id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  try {
    slotsRepository.deleteOwnedSlotIfUnused({ doctorId: Number(doctorRecordId), slotId });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.get("/:id/slots", (req, res, next) => {
  const id = req.params.id;
  if (Number.isNaN(Number(id))) {
    const err = new Error("Invalid doctor id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }

  const doctor = doctorsRepository.getById(id);
  if (!doctor) {
    const err = new Error("Doctor not found");
    err.status = 404;
    err.errorCode = "DOCTOR_NOT_FOUND";
    next(err);
    return;
  }

  const slots = slotsRepository.getAvailableByDoctorId(id);
  res.status(200).json(slots);
});

router.post("/:id/slots", requireAuth, requireRoles("doctor"), (req, res, next) => {
  const doctorIdParam = req.params.id;
  if (Number.isNaN(Number(doctorIdParam))) {
    const err = new Error("Invalid doctor id");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const doctorRecordId = req.user.doctorRecordId;
  if (doctorRecordId == null || Number(doctorRecordId) !== Number(doctorIdParam)) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  const { startTime, endTime, isAvailable } = req.body ?? {};
  if (typeof startTime !== "string" || !startTime.trim() || typeof endTime !== "string" || !endTime.trim()) {
    const err = new Error("startTime and endTime are required ISO strings");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const startMs = Date.parse(startTime.trim());
  const endMs = Date.parse(endTime.trim());
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    const err = new Error("startTime and endTime must be valid datetimes");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (endMs <= startMs) {
    const err = new Error("endTime must be after startTime");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (!doctorsRepository.getById(doctorIdParam)) {
    const err = new Error("Doctor not found");
    err.status = 404;
    err.errorCode = "DOCTOR_NOT_FOUND";
    next(err);
    return;
  }
  try {
    const slot = slotsRepository.insertSlot({
      doctorId: Number(doctorIdParam),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      isAvailable: isAvailable !== false,
    });
    res.status(201).json(slot);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", (req, res, next) => {
  const doctor = doctorsRepository.getById(req.params.id);
  if (!doctor) {
    const err = new Error("Doctor not found");
    err.status = 404;
    err.errorCode = "DOCTOR_NOT_FOUND";
    next(err);
    return;
  }
  res.status(200).json(doctor);
});

module.exports = router;
