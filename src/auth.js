import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./config/db.js";

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function originFrom(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  const values = [
    process.env.BETTER_AUTH_URL,
    process.env.BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RENDER_EXTERNAL_HOSTNAME,
  ];
  const origins = new Set();
  for (const value of values) {
    const origin = originFrom(value);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

export function resolveAuthBaseURL() {
  const origins = configuredOrigins();
  const onRender = Boolean(
    process.env.RENDER_EXTERNAL_URL || process.env.RENDER_EXTERNAL_HOSTNAME
  );

  if (onRender) {
    const publicOrigin = origins.find((origin) => {
      try {
        return !isLocalHost(new URL(origin).hostname);
      } catch {
        return false;
      }
    });
    if (publicOrigin) return publicOrigin;
  }

  return origins[0] || `http://localhost:${process.env.PORT || 3000}`;
}

const baseURL = resolveAuthBaseURL();

const secret =
  process.env.BETTER_AUTH_SECRET ||
  process.env.JWT_SECRET ||
  "dev-only-change-me";

const trustedOrigins = [...new Set([...configuredOrigins(), baseURL])].filter(
  (origin) => {
    if (!origin) return false;
    if (!process.env.RENDER_EXTERNAL_URL && !process.env.RENDER_EXTERNAL_HOSTNAME) {
      return true;
    }
    try {
      return !isLocalHost(new URL(origin).hostname);
    } catch {
      return true;
    }
  }
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret,
  baseURL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  trustedOrigins: trustedOrigins.length ? trustedOrigins : [baseURL],
  advanced: {
    disableOriginCheck: process.env.NODE_ENV !== "production",
    disableCSRFCheck: process.env.NODE_ENV !== "production",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});
