const rateLimit = require("express-rate-limit");
const env = require("../config/env");

function makeRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        errorCode: "RATE_LIMITED",
        message,
        requestId: req.requestId,
      });
    },
  });
}

const loginLimiter = makeRateLimiter({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX,
  message: "Too many login attempts; try again later.",
});

const registerLimiter = makeRateLimiter({
  windowMs: env.RATE_LIMIT_REGISTER_WINDOW_MS,
  max: env.RATE_LIMIT_REGISTER_MAX,
  message: "Too many registration attempts; try again later.",
});

const bookingLimiter = makeRateLimiter({
  windowMs: env.RATE_LIMIT_BOOKING_WINDOW_MS,
  max: env.RATE_LIMIT_BOOKING_MAX,
  message: "Too many booking attempts; try again later.",
});

module.exports = { loginLimiter, registerLimiter, bookingLimiter };