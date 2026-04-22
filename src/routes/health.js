const express = require("express");
const db = require("../db/connection");
const env = require("../config/env");
const { snapshot } = require("../metrics");

const router = express.Router();

router.get("/health", (_req, res) => {
  const checks = {
    database: { status: "unknown" },
    ai: {
      status: "unknown",
      recommendationEnabled: env.ENABLE_AI_RECOMMENDATION,
      implementation: "rule-based",
    },
  };

  try {
    db.prepare("SELECT 1 AS ok").get();
    checks.database.status = "up";
  } catch (err) {
    checks.database.status = "down";
    checks.database.message = err.message;
  }

  checks.ai.status = env.ENABLE_AI_RECOMMENDATION ? "up" : "disabled";

  const dbUp = checks.database.status === "up";
  const status = dbUp ? "ok" : "degraded";
  res.status(dbUp ? 200 : 503).json({ status, checks });
});

router.get("/metrics", (_req, res) => {
  res.status(200).json(snapshot());
});

module.exports = router;
