const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const url = require("url");
const env = require("../config/env");
const usersRepository = require("../repositories/usersRepository");
const connections = require("./connections");
const logger = require("../logger");

function createWsServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const { query } = url.parse(req.url, true);
    const token = query.token;

    let user;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (payload.typ === "refresh") throw new Error("refresh token not allowed");
      user = usersRepository.getPublicById(Number(payload.sub));
      if (!user) throw new Error("user not found");
    } catch {
      ws.close(4001, "Unauthorized");
      return;
    }

    if (user.role === "doctor") {
      if (user.doctorRecordId == null) {
        ws.close(4003, "Forbidden");
        return;
      }
      const { doctorRecordId } = user;
      connections.add(doctorRecordId, ws);
      logger.info({ event: "ws.connected", doctorRecordId, userId: user.id }, "WS doctor connected");
      ws.on("close", () => {
        connections.remove(doctorRecordId, ws);
        logger.info({ event: "ws.disconnected", doctorRecordId }, "WS doctor disconnected");
      });
      ws.on("error", (err) => {
        logger.warn({ event: "ws.error", doctorRecordId, err: err.message }, "WS error");
        connections.remove(doctorRecordId, ws);
      });
    } else if (user.role === "patient") {
      const patientId = user.id;
      connections.addPatient(patientId, ws);
      logger.info({ event: "ws.connected", patientId, userId: user.id }, "WS patient connected");
      ws.on("close", () => {
        connections.removePatient(patientId, ws);
        logger.info({ event: "ws.disconnected", patientId }, "WS patient disconnected");
      });
      ws.on("error", (err) => {
        logger.warn({ event: "ws.error", patientId, err: err.message }, "WS error");
        connections.removePatient(patientId, ws);
      });
    } else {
      ws.close(4003, "Forbidden");
    }
  });

  return wss;
}

module.exports = { createWsServer };
