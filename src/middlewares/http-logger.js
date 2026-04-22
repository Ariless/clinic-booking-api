const pinoHttp = require("pino-http");
const logger = require("../logger");

/**
 * One JSON line per HTTP request (latency, status, method, path).
 * Attaches `req.log` (a Pino child) for structured domain events in route handlers.
 */
function httpLogger() {
  return pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    customProps: (req) => ({ requestId: req.requestId }),
    autoLogging: {
      ignore: (req) => {
        const p = req.path || req.url || "";
        return p === "/health" || p === "/metrics";
      },
    },
  });
}

module.exports = { httpLogger };
