const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const usersRepository = require("../repositories/usersRepository");
const doctorsRepository = require("../repositories/doctorsRepository");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_NAME_LEN = 120;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      doctorRecordId: user.doctorRecordId,
      typ: "access",
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function issueRefreshToken(user) {
  return jwt.sign({ sub: user.id, typ: "refresh" }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function byteLengthUtf8(str) {
  return Buffer.byteLength(str, "utf8");
}

router.post("/register", (req, res, next) => {
  const { email, password, name, role, doctorRecordId } = req.body ?? {};
  if (!isNonEmptyString(email) || !EMAIL_RE.test(email.trim())) {
    const err = new Error("Valid email is required");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const emailTrim = email.trim();
  if (emailTrim.length > MAX_EMAIL_LEN) {
    const err = new Error("Email is too long");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (typeof password !== "string" || password.length < 6) {
    const err = new Error("Password must be at least 6 characters");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (byteLengthUtf8(password) > BCRYPT_MAX_PASSWORD_BYTES) {
    const err = new Error(`Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes (UTF-8)`);
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  if (!isNonEmptyString(name)) {
    const err = new Error("Name is required");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const nameTrim = name.trim();
  if (nameTrim.length > MAX_NAME_LEN) {
    const err = new Error(`Name must be at most ${MAX_NAME_LEN} characters`);
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const roleNorm = role == null || role === "" ? null : String(role).trim().toLowerCase();
  if (roleNorm && roleNorm !== "patient" && roleNorm !== "doctor") {
    const err = new Error("role must be patient or doctor");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const resolvedRole = roleNorm === "doctor" ? "doctor" : "patient";
  if (resolvedRole === "doctor") {
    const rid = doctorRecordId;
    if (!Number.isInteger(rid) || rid < 1) {
      const err = new Error("doctorRecordId is required for doctor registration");
      err.status = 400;
      err.errorCode = "VALIDATION_ERROR";
      next(err);
      return;
    }
    if (!doctorsRepository.getById(rid)) {
      const err = new Error("Doctor record not found");
      err.status = 404;
      err.errorCode = "DOCTOR_NOT_FOUND";
      next(err);
      return;
    }
  }
  const emailNorm = emailTrim.toLowerCase();
  const existingRow = usersRepository.getByEmailAnyStatus(emailNorm);
  if (existingRow && existingRow.deletedAt == null) {
    const err = new Error("An account with this email is already registered");
    err.status = 409;
    err.errorCode = "EMAIL_TAKEN";
    next(err);
    return;
  }
  if (existingRow && existingRow.deletedAt != null) {
    const err = new Error("This email was used on a closed account and cannot be reused in this demo");
    err.status = 409;
    err.errorCode = "EMAIL_RETIRED";
    next(err);
    return;
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const doctorRid = resolvedRole === "doctor" ? doctorRecordId : null;
  const user = usersRepository.createUser({
    email: emailNorm,
    passwordHash,
    name: nameTrim,
    role: resolvedRole,
    doctorRecordId: doctorRid,
  });
  const token = issueAccessToken(user);
  const refreshToken = issueRefreshToken(user);
  req.log.info(
    { event: "auth.register", userId: user.id, role: user.role },
    "account created"
  );
  res.status(201).json({ token, refreshToken, user });
});

router.get("/me", requireAuth, (req, res) => {
  const user = req.user;
  let doctorProfile = null;
  if (user.doctorRecordId != null) {
    doctorProfile = doctorsRepository.getById(user.doctorRecordId) ?? null;
  }
  res.status(200).json({ user, doctorProfile });
});

router.delete("/me", requireAuth, (req, res, next) => {
  const role = req.user.role;
  if (role !== "patient" && role !== "doctor") {
    const err = new Error("Only patient or doctor accounts can be closed from this demo");
    err.status = 403;
    err.errorCode = "FORBIDDEN";
    next(err);
    return;
  }
  usersRepository.softDeleteUser(req.user.id);
  req.log.info(
    { event: "auth.account_closed", userId: req.user.id, role },
    "account soft-deleted"
  );
  res.status(204).end();
});

router.post("/login", (req, res, next) => {
  const { email, password } = req.body ?? {};
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    const err = new Error("email and password are required");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  const row = usersRepository.getByEmail(email.trim().toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password)) {
    req.log.warn({ event: "auth.login", outcome: "failure" }, "login rejected");
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.errorCode = "AUTH_INVALID";
    next(err);
    return;
  }
  const user = usersRepository.getPublicById(row.id);
  const token = issueAccessToken(user);
  const refreshToken = issueRefreshToken(user);
  req.log.info(
    { event: "auth.login", outcome: "success", userId: user.id, role: user.role },
    "session started"
  );
  res.status(200).json({ token, refreshToken, user });
});

router.post("/refresh", (req, res, next) => {
  const { refreshToken } = req.body ?? {};
  if (!isNonEmptyString(refreshToken)) {
    const err = new Error("refreshToken is required");
    err.status = 400;
    err.errorCode = "VALIDATION_ERROR";
    next(err);
    return;
  }
  try {
    const payload = jwt.verify(refreshToken.trim(), env.JWT_SECRET);
    if (payload.typ !== "refresh") {
      const err = new Error("Not a refresh token");
      err.status = 400;
      err.errorCode = "VALIDATION_ERROR";
      next(err);
      return;
    }
    const user = usersRepository.getPublicById(Number(payload.sub));
    if (!user) {
      const err = new Error("User not found");
      err.status = 401;
      err.errorCode = "AUTH_INVALID";
      next(err);
      return;
    }
    res.status(200).json({
      token: issueAccessToken(user),
      refreshToken: issueRefreshToken(user),
      user,
    });
  } catch {
    const err = new Error("Invalid or expired refresh token");
    err.status = 401;
    err.errorCode = "AUTH_INVALID";
    next(err);
  }
});

module.exports = router;
