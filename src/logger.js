const pino = require("pino");
const env = require("./config/env");

const rootOptions = {
  level: env.LOG_LEVEL,
  base: { service: "clinic-booking-api", env: env.NODE_ENV },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie"],
    remove: false,
    censor: "[Redacted]",
  },
};

let logger;
if (env.NODE_ENV === "development" && env.LOG_PRETTY) {
  try {
    require.resolve("pino-pretty");
    logger = pino({
      ...rootOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    });
  } catch {
    logger = pino(rootOptions);
  }
} else {
  logger = pino(rootOptions);
}

module.exports = logger;
