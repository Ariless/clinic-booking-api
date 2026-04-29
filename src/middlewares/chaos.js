const env = require("../config/env");
const logger = require("../logger");

function mulberry32(seed) {
  let t = seed;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const rng =
  env.CHAOS_SEED != null
    ? mulberry32(hashSeed(env.CHAOS_SEED))
    : () => Math.random();

function chaos(req, res, next) {
  if (!env.CHAOS_ENABLED) return next();

  if (rng() < env.CHAOS_FAIL_PROBABILITY) {
    logger.warn({ event: "chaos.fail", path: req.path, requestId: req.id });
    return res.status(503).json({
      errorCode: "CHAOS_ERROR",
      message: "Chaos mode: simulated service failure",
      requestId: req.id,
    });
  }

  if (env.CHAOS_LATENCY_MS > 0) {
    const delay = Math.floor(rng() * env.CHAOS_LATENCY_MS);
    logger.warn({ event: "chaos.latency", delay, path: req.path, requestId: req.id });
    return setTimeout(next, delay);
  }

  next();
}

module.exports = { chaos };