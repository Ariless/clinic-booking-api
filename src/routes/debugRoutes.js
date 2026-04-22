const express = require("express");
const env = require("../config/env");
const appointmentsRepository = require("../repositories/appointmentsRepository");

const router = express.Router();

function guardDebug(req, res, next) {
  if (env.NODE_ENV !== "development" || !env.ENABLE_DEBUG_ROUTES) {
    res.status(404).json({
      errorCode: "NOT_FOUND",
      message: "Not found",
      requestId: req.requestId,
    });
    return;
  }
  next();
}

router.use(guardDebug);

/**
 * Two sequential booking attempts on the same slot (same Node thread).
 * Second attempt should fail with DB / domain guard when the first succeeded.
 * For a true HTTP race, use two parallel clients (e.g. curl) against POST /api/v1/appointments.
 */
router.post("/simulate-concurrent-booking", (req, res, next) => {
  const { slotId, patientId1, patientId2 } = req.body ?? {};
  const okInt = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;
  if (!okInt(slotId) || !okInt(patientId1) || !okInt(patientId2)) {
    const err = new Error("slotId, patientId1, and patientId2 must be positive integers");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (patientId1 === patientId2) {
    const err = new Error("patientId1 and patientId2 must differ");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }

  const outcomes = [];
  for (const patientId of [patientId1, patientId2]) {
    try {
      const appointment = appointmentsRepository.bookSlot({ slotId, patientId });
      outcomes.push({ patientId, ok: true, appointmentId: appointment.id, status: appointment.status });
    } catch (e) {
      outcomes.push({
        patientId,
        ok: false,
        errorCode: e.errorCode || "INTERNAL_ERROR",
        message: e.message,
        httpStatus: e.status || 500,
      });
    }
  }

  res.status(200).json({
    note:
      "Runs two booking attempts on the same OS thread in order; the second should fail if the first booked the slot. For overlapping HTTP handlers, use two parallel HTTP clients.",
    outcomes,
  });
});

module.exports = router;
