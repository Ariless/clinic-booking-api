const express = require("express");
const env = require("../config/env");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    name: "clinic-booking-api",
    version: "1.0.0",
    environment: env.NODE_ENV,
  });
});

router.get("/error-test", (_req, _res) => {
  const e = new Error("Test error");
  e.status = 418;
  e.errorCode = "TEST_ERROR";
  throw e;
});

module.exports = router;
