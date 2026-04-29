const { errorHandler } = require("./middlewares/error-handler");
const { requestId } = require("./middlewares/request-id");
const { httpLogger } = require("./middlewares/http-logger");
const { notFoundHandler } = require("./middlewares/not-found-handler");
const path = require("path");
const express = require("express");
const indexRoutes = require("./routes/index");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/authRoutes");
const aiRoutes = require("./routes/aiRoutes");
const doctorsRoutes = require("./routes/doctorsRoutes");
const appointmentsRoutes = require("./routes/appointmentsRoutes");
const { mountSwagger } = require("./swagger");
const { chaos } = require("./middlewares/chaos");
const env = require("./config/env");
const app = express();

const publicDir = path.join(__dirname, "..", "public");

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use((req, res, next) => {
  res.setHeader("X-Clinic-Booking-Learning", "1");
  next();
});

app.use(requestId);
app.use(httpLogger());
app.use(express.json());

app.use("/api/v1", chaos);
app.use("/api/v1/auth", authRoutes);
if (env.NODE_ENV === "development" && env.ENABLE_DEBUG_ROUTES) {
  app.use("/api/v1/debug", require("./routes/debugRoutes"));
}
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/doctors", doctorsRoutes);
app.use("/api/v1/appointments", appointmentsRoutes);
app.use("/api/v1", indexRoutes);
mountSwagger(app);

function sendPublicHtml(fileName) {
  return (_req, res, next) => {
    res.sendFile(path.join(publicDir, fileName), (err) => {
      if (err) {
        next(err);
      }
    });
  };
}

app.get("/login", (_req, res, next) => {
  res.sendFile(path.join(publicDir, "login.html"), (err) => {
    if (err) {
      next(err);
    }
  });
});

app.get("/register/patient", sendPublicHtml("register-patient.html"));
app.get("/register/doctor", sendPublicHtml("register-doctor.html"));
app.get("/register", sendPublicHtml("register.html"));

app.get("/", sendPublicHtml("index.html"));
app.get("/patient/booking", sendPublicHtml("patient-booking.html"));
app.get("/patient/schedule", sendPublicHtml("patient-schedule.html"));
app.get("/patient/appointments", sendPublicHtml("patient-appointments.html"));
app.get("/patient/account", sendPublicHtml("patient-account.html"));
app.get("/patient", sendPublicHtml("patient.html"));
app.get("/doctor/appointments", sendPublicHtml("doctor-appointments.html"));
app.get("/doctor/schedule", sendPublicHtml("doctor-schedule.html"));
app.get("/doctor/account", sendPublicHtml("doctor-account.html"));
app.get("/doctor", sendPublicHtml("doctor.html"));
app.use(express.static(publicDir));
app.use("/", healthRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
