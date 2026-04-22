const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const ipKeyGenerator = rateLimit.ipKeyGenerator;
const env = require("../config/env");
const { recommendDoctors } = require("../services/aiRecommendation");

const router = express.Router();

function requireAiRecommendation(_req, res, next) {
  if (!env.ENABLE_AI_RECOMMENDATION) {
    const err = new Error("AI recommendation is disabled");
    err.status = 503;
    err.errorCode = "FEATURE_DISABLED";
    next(err);
    return;
  }
  next();
}

function aiRateLimitKey(req) {
  const auth = req.headers.authorization || "";
  const suffix = auth
    ? crypto.createHash("sha256").update(auth).digest("hex").slice(0, 16)
    : "guest";
  return `${ipKeyGenerator(req.ip)}:${suffix}`;
}

const recommendLimiter = rateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX,
  keyGenerator: aiRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      errorCode: "RATE_LIMITED",
      message: "Too many AI recommendation requests; try again later.",
      requestId: req.requestId,
    });
  },
});

router.post(
  "/recommend-doctor",
  requireAiRecommendation,
  recommendLimiter,
  (req, res, next) => {
    const { symptoms } = req.body ?? {};
    if (typeof symptoms !== "string" || !symptoms.trim()) {
      const err = new Error("symptoms must be a non-empty string");
      err.status = 400;
      err.errorCode = "VALIDATION_ERROR";
      next(err);
      return;
    }
    const result = recommendDoctors(symptoms);
    if (!result.ok) {
      const err = new Error("Could not map symptoms to a known specialty");
      err.status = 422;
      err.errorCode = "UNKNOWN_SPECIALTY";
      next(err);
      return;
    }
    req.log.info(
      {
        event: "ai.recommend_doctor",
        recommendedSpecialty: result.recommendedSpecialty,
        doctorCount: result.doctors.length,
        symptomsCharCount: symptoms.trim().length,
      },
      "rule-based recommendation returned"
    );
    res.status(200).json({
      recommendedSpecialty: result.recommendedSpecialty,
      doctors: result.doctors,
    });
  }
);

module.exports = router;
