import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { signToken } from "../utils/jwt.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerUser(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new AppError("Enter a valid email address", 400);
  }
  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: normalized, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  return { user, token: signToken(user) };
}

export async function loginUser(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const ok = await bcrypt.compare(password || "", user.passwordHash);
  if (!ok) {
    throw new AppError("Invalid email or password", 401);
  }

  const safe = { id: user.id, email: user.email, createdAt: user.createdAt };
  return { user: safe, token: signToken(safe) };
}
