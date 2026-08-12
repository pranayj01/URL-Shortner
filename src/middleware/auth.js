import { verifyToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: Number(payload.sub), email: payload.email };
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Login required", 401));
  }

  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: Number(payload.sub), email: payload.email };
    next();
  } catch {
    next(new AppError("Invalid or expired token. Please log in again.", 401));
  }
}
