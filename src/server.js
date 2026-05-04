const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const http = require("http");
dotenv.config();
const { migrate } = require("./db/migrate");
migrate();

const logger = require("./logger");
const metrics = require("./metrics");
const appointmentsRepository = require("./repositories/appointmentsRepository");
const app = require("./app");
const env = require("./config/env");
const { createWsServer } = require("./ws/wsServer");

const publicDirCheck = path.join(__dirname, "..", "public");
for (const name of [
  "index.html",
  "patient.html",
  "patient-booking.html",
  "patient-appointments.html",
  "patient-account.html",
  "doctor.html",
  "doctor-appointments.html",
  "doctor-schedule.html",
  "doctor-account.html",
  "login.html",
  "register.html",
  "register-patient.html",
  "register-doctor.html",
  "js/app-core.js",
  "js/app-nav.js",
  "js/directory-by-specialty.js",
  "js/doctor-shell.js",
  "js/patient-shell.js",
  "css/app.css",
]) {
  const p = path.join(publicDirCheck, name);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing demo UI asset: ${path.resolve(p)}`);
  }
}

const httpServer = http.createServer(app);
createWsServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      urls: {
        ui: `http://localhost:${env.PORT}/`,
        patient: `http://localhost:${env.PORT}/patient`,
        doctor: `http://localhost:${env.PORT}/doctor`,
        login: `http://localhost:${env.PORT}/login`,
        register: `http://localhost:${env.PORT}/register`,
        openapiUi: `http://localhost:${env.PORT}/api/docs`,
        openapiYaml: `http://localhost:${env.PORT}/api/openapi.yaml`,
      },
    },
    "HTTP server listening"
  );

  if (env.AUTO_EXPIRE_PENDING_INTERVAL_MS > 0) {
    const tick = () => {
      try {
        const n = appointmentsRepository.expireStalePendingAppointments(env.AUTO_EXPIRE_PENDING_MAX_AGE_MS);
        if (n > 0) {
          metrics.inc("appointments_pending_expired_total", n);
          logger.info({ event: "appointments.pending_expired", count: n }, "expired stale pending appointments");
        }
      } catch (err) {
        logger.error({ err }, "expireStalePendingAppointments failed");
      }
    };
    const t = setInterval(tick, env.AUTO_EXPIRE_PENDING_INTERVAL_MS);
    if (typeof t.unref === "function") {
      t.unref();
    }
  }
});