const jwt = require("jsonwebtoken");
const env = require("../config/env");
const usersRepository = require("../repositories/usersRepository");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    const err = new Error("Authentication required");
    err.status = 401;
    err.errorCode = "AUTH_REQUIRED";
    next(err);
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    const err = new Error("Authentication required");
    err.status = 401;
    err.errorCode = "AUTH_REQUIRED";
    next(err);
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.typ === "refresh") {
      const err = new Error("Use an access token for this request");
      err.status = 401;
      err.errorCode = "AUTH_INVALID";
      next(err);
      return;
    }
    const userId = payload.sub;
    if (!Number.isInteger(Number(userId))) {
      throw new Error("invalid sub");
    }
    const user = usersRepository.getPublicById(Number(userId));
    if (!user) {
      const err = new Error("User not found");
      err.status = 401;
      err.errorCode = "AUTH_INVALID";
      next(err);
      return;
    }
    req.user = user;
    next();
  } catch {
    const err = new Error("Invalid or expired token");
    err.status = 401;
    err.errorCode = "AUTH_INVALID";
    next(err);
  }
}

function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      const err = new Error("Authentication required");
      err.status = 401;
      err.errorCode = "AUTH_REQUIRED";
      next(err);
      return;
    }
    if (!allowed.includes(req.user.role)) {
      const err = new Error("Forbidden");
      err.status = 403;
      err.errorCode = "FORBIDDEN";
      next(err);
      return;
    }
    next();
  };
}

module.exports = { requireAuth, requireRoles };
