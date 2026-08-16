import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";
import { AppError } from "../utils/AppError.js";

async function loadSessionUser(req) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

export async function optionalAuth(req, _res, next) {
  try {
    req.user = await loadSessionUser(req);
  } catch {
    req.user = null;
  }
  next();
}

export async function requireAuth(req, _res, next) {
  try {
    const user = await loadSessionUser(req);
    if (!user) {
      return next(new AppError("Login required", 401));
    }
    req.user = user;
    next();
  } catch {
    next(new AppError("Invalid or expired session. Please log in again.", 401));
  }
}
