const express = require("express");
const env = require("../config/env");
const { requireAuth, requireRoles } = require("../middlewares/auth");
const { charge } = require("../services/paymentService");
const { findByIdempotencyKey, createPayment } = require("../repositories/paymentsRepository");
const { createConsultation, getByPatientId } = require("../repositories/consultationsRepository");
const doctorsRepository = require("../repositories/doctorsRepository");

const CONSULTATION_AMOUNT = 5000; // $50.00 in cents

const router = express.Router();

router.get("/me", requireAuth, requireRoles("patient"), (req, res) => {
  const consultations = getByPatientId(req.user.id);
  res.status(200).json(consultations);
});

router.post("/", requireAuth, requireRoles("patient"), (req, res, next) => {
  if (env.PAYMENT_MODE === "disabled") {
    const err = new Error("Online consultations are not available");
    err.status = 503;
    err.errorCode = "FEATURE_DISABLED";
    next(err);
    return;
  }

  const { doctorId, paymentMethod } = req.body ?? {};

  if (!Number.isInteger(doctorId) || doctorId < 1) {
    const err = new Error("doctorId must be a positive integer");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (!paymentMethod || typeof paymentMethod !== "string" || !paymentMethod.trim()) {
    const err = new Error("paymentMethod is required");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }

  const doctor = doctorsRepository.getById(doctorId);
  if (!doctor) {
    const err = new Error("Doctor not found");
    err.status = 404;
    err.errorCode = "DOCTOR_NOT_FOUND";
    next(err);
    return;
  }

  const idempotencyKey = req.headers["x-idempotency-key"] || null;
  const patientId = req.user.id;

  // Idempotency check — return cached result if key already used
  if (idempotencyKey) {
    const existing = findByIdempotencyKey(idempotencyKey, patientId);
    if (existing) {
      if (existing.status === "succeeded") {
        const { getById } = require("../repositories/consultationsRepository");
        const consultation = getById(existing.consultationId);
        res.status(200).json({ consultation, payment: existing });
      } else {
        const err = new Error("Your card was declined");
        err.status = 402;
        err.errorCode = "PAYMENT_REQUIRED";
        next(err);
      }
      return;
    }
  }

  try {
    const result = charge({ paymentMethod });

    if (!result.success) {
      const payment = createPayment({
        consultationId: null,
        patientId,
        paymentMethod,
        status: "failed",
        amount: CONSULTATION_AMOUNT,
        idempotencyKey,
      });
      req.log.warn(
        { event: "consultation.payment_failed", patientId, doctorId, paymentId: payment.id },
        "consultation payment failed"
      );
      const err = new Error("Your card was declined");
      err.status = 402;
      err.errorCode = "PAYMENT_REQUIRED";
      next(err);
      return;
    }

    const consultation = createConsultation({ doctorId, patientId });
    const payment = createPayment({
      consultationId: consultation.id,
      patientId,
      paymentMethod,
      status: "succeeded",
      amount: CONSULTATION_AMOUNT,
      idempotencyKey,
    });

    req.log.info(
      { event: "consultation.created", consultationId: consultation.id, patientId, doctorId, paymentId: payment.id },
      "consultation created"
    );

    res.status(201).json({ consultation, payment });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
