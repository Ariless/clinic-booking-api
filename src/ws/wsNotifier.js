const { WebSocket } = require("ws");
const connections = require("./connections");
const logger = require("../logger");

function notifyDoctor(doctorRecordId, event, payload) {
  const sockets = connections.get(doctorRecordId);
  if (sockets.size === 0) return;
  const message = JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
  logger.info({ event: "ws.sent", wsEvent: event, doctorRecordId, recipients: sockets.size }, "WS notification sent");
}

function notifyPatient(patientId, event, payload) {
  const sockets = connections.getPatient(patientId);
  if (sockets.size === 0) return;
  const message = JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
  logger.info({ event: "ws.sent", wsEvent: event, patientId, recipients: sockets.size }, "WS patient notification sent");
}

module.exports = { notifyDoctor, notifyPatient };
