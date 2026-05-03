const allowedNodeEnvs = ["development", "test", "production"];

function parseBool(raw, defaultValue) {
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }
  const v = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(v)) {
    return false;
  }
  throw new Error(`Invalid boolean environment value: ${raw}`);
}

function parseNonNegativeInt(raw, defaultValue) {
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid non-negative integer environment value: ${raw}`);
  }
  return n;
}

function parsePositiveInt(raw, defaultValue) {
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid positive integer environment value: ${raw}`);
  }
  return n;
}

const NODE_ENV = process.env.NODE_ENV || "development";
if (!allowedNodeEnvs.includes(NODE_ENV)) {
  throw new Error(`Invalid NODE_ENV: ${NODE_ENV}`);
}

const PORT = Number(process.env.PORT) || 3000;

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/clinic.db";
if (!DATABASE_PATH.startsWith("./")) {
  throw new Error(`DATABASE_PATH must be a relative path: ${DATABASE_PATH}`);
}

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  JWT_SECRET = "dev-only-insecure-jwt-secret";
}

/** Access JWT (e.g. `15m`, `1h`, `7d`). */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
/** Refresh JWT (long-lived). */
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/** Pino level: `trace` … `fatal` (see https://getpino.io/#/docs/api?id=level-string) */
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/** Human-readable logs in development (requires devDependency `pino-pretty`). */
const LOG_PRETTY = parseBool(process.env.LOG_PRETTY, false);

/** When false, POST /api/v1/ai/recommend-doctor responds with 503 FEATURE_DISABLED. */
const ENABLE_AI_RECOMMENDATION = parseBool(process.env.ENABLE_AI_RECOMMENDATION, true);

/** Sliding window for AI rate limit (ms). */
const AI_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 60_000);

/** Max AI recommendation requests per window per client key (IP + optional auth hash). */
const AI_RATE_LIMIT_MAX = parsePositiveInt(process.env.AI_RATE_LIMIT_MAX, 5);

/** Login rate limit: max attempts per IP per window. */
const RATE_LIMIT_LOGIN_WINDOW_MS = parsePositiveInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60 * 1000);
const RATE_LIMIT_LOGIN_MAX = parsePositiveInt(process.env.RATE_LIMIT_LOGIN_MAX, 10);

/** Register rate limit: max attempts per IP per window. */
const RATE_LIMIT_REGISTER_WINDOW_MS = parsePositiveInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS, 60 * 60 * 1000);
const RATE_LIMIT_REGISTER_MAX = parsePositiveInt(process.env.RATE_LIMIT_REGISTER_MAX, 5);

/** Booking rate limit: max attempts per IP per window. */
const RATE_LIMIT_BOOKING_WINDOW_MS = parsePositiveInt(process.env.RATE_LIMIT_BOOKING_WINDOW_MS, 60 * 1000);
const RATE_LIMIT_BOOKING_MAX = parsePositiveInt(process.env.RATE_LIMIT_BOOKING_MAX, 20);

/** Trust `X-Forwarded-*` when behind a reverse proxy (e.g. Docker). */
const TRUST_PROXY = parseBool(process.env.TRUST_PROXY, false);

/**
 * If &gt; 0, run a timer that cancels very old `pending` appointments and frees slots.
 * Set to `0` to disable.
 */
const AUTO_EXPIRE_PENDING_INTERVAL_MS = parseNonNegativeInt(
  process.env.AUTO_EXPIRE_PENDING_INTERVAL_MS,
  0
);

/** Pending rows older than this (ms since `createdAt`) are expired by the timer. Default: 7 days. */
const AUTO_EXPIRE_PENDING_MAX_AGE_MS = parsePositiveInt(
  process.env.AUTO_EXPIRE_PENDING_MAX_AGE_MS,
  7 * 24 * 60 * 60 * 1000
);

/** Exposes POST /api/v1/debug/* (only when NODE_ENV is `development`). */
const ENABLE_DEBUG_ROUTES = parseBool(process.env.ENABLE_DEBUG_ROUTES, false);

const CHAOS_ENABLED = parseBool(process.env.CHAOS_ENABLED, false);
const CHAOS_FAIL_PROBABILITY = (() => {
  const raw = process.env.CHAOS_FAIL_PROBABILITY;
  if (raw === undefined || raw === "") return 0.2;
  const n = parseFloat(raw);
  if (isNaN(n) || n < 0 || n > 1) throw new Error(`Invalid CHAOS_FAIL_PROBABILITY: ${raw}`);
  return n;
})();
const CHAOS_LATENCY_MS = parseNonNegativeInt(process.env.CHAOS_LATENCY_MS, 0);
const CHAOS_SEED = process.env.CHAOS_SEED ?? null;

/** Optional URL to POST appointment status-change events to. Omit to disable webhooks. */
const WEBHOOK_URL = process.env.WEBHOOK_URL || null;

/** Payment mode for consultations: disabled | mock_success | mock_fail */
const PAYMENT_MODE = (() => {
  const raw = process.env.PAYMENT_MODE || "disabled";
  if (!["disabled", "mock_success", "mock_fail"].includes(raw)) {
    throw new Error(`Invalid PAYMENT_MODE: ${raw}`);
  }
  return raw;
})();

const env = {
  PORT,
  NODE_ENV,
  DATABASE_PATH,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  LOG_LEVEL,
  LOG_PRETTY,
  ENABLE_AI_RECOMMENDATION,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_RATE_LIMIT_MAX,
  RATE_LIMIT_LOGIN_WINDOW_MS,
  RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_REGISTER_WINDOW_MS,
  RATE_LIMIT_REGISTER_MAX,
  RATE_LIMIT_BOOKING_WINDOW_MS,
  RATE_LIMIT_BOOKING_MAX,
  TRUST_PROXY,
  AUTO_EXPIRE_PENDING_INTERVAL_MS,
  AUTO_EXPIRE_PENDING_MAX_AGE_MS,
  ENABLE_DEBUG_ROUTES,
  CHAOS_ENABLED,
  CHAOS_FAIL_PROBABILITY,
  CHAOS_LATENCY_MS,
  CHAOS_SEED,
  WEBHOOK_URL,
  PAYMENT_MODE,
};

module.exports = env;
