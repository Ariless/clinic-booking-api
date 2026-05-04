const env = require("../config/env");
const logger = require("../logger");

async function notify(event, payload) {
  if (!env.WEBHOOK_URL) return;
  try {
    const res = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
    });
    if (!res.ok) {
      logger.warn(
        { event: "webhook.failed", httpStatus: res.status, webhookEvent: event },
        "webhook delivery failed"
      );
    }
  } catch (err) {
    logger.warn(
      { event: "webhook.error", err: err.message, webhookEvent: event },
      "webhook request error"
    );
  }
}

module.exports = { notify };