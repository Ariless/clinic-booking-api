const rootLogger = require("../logger");

const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  const errorCode = err.errorCode || "INTERNAL_ERROR";
  const message = err.message || "Unexpected error";

  const log = req.log || rootLogger.child({ requestId: req.requestId });
  if (status >= 500) {
    log.error({ err, errorCode, status, path: req.path }, "server error response");
  }

  res.status(status).json({
    errorCode,
    message,
    requestId: req.requestId,
  });
};

module.exports = { errorHandler };
