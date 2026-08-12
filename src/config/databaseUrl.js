/**
 * Render's internal Postgres hostname looks like `dpg-xxxxx-a` (no dot).
 * Prisma cannot resolve that form and throws P1001.
 * Internal DNS works with `dpg-xxxxx-a.internal`.
 * Public connections use `*.render.com` and need TLS.
 */
export function normalizeDatabaseUrl(raw) {
  if (!raw || typeof raw !== "string") return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname;

    if (/^dpg-[a-z0-9]+-a$/i.test(host)) {
      url.hostname = `${host}.internal`;
    }

    if (
      url.hostname.endsWith(".render.com") &&
      !url.searchParams.has("sslmode")
    ) {
      url.searchParams.set("sslmode", "require");
    }

    if (
      url.hostname.endsWith(".internal") &&
      !url.searchParams.has("sslmode")
    ) {
      url.searchParams.set("sslmode", "disable");
    }

    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "10");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Render's internal Postgres hostname looks like `dpg-xxxxx-a` (no dot).
 * Prisma cannot resolve that form and throws P1001.
 * Internal DNS works with `dpg-xxxxx-a.internal`.
 * Public connections use `*.render.com` and need TLS.
 */
export function normalizeDatabaseUrl(raw) {
  if (!raw || typeof raw !== "string") return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname;

    if (/^dpg-[a-z0-9]+-a$/i.test(host)) {
      url.hostname = `${host}.internal`;
    }

    if (
      url.hostname.endsWith(".render.com") &&
      !url.searchParams.has("sslmode")
    ) {
      url.searchParams.set("sslmode", "require");
    }

    if (
      url.hostname.endsWith(".internal") &&
      !url.searchParams.has("sslmode")
    ) {
      url.searchParams.set("sslmode", "disable");
    }

    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "10");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

export function applyDatabaseUrl() {
  const preferred =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.EXTERNAL_DATABASE_URL ||
    process.env.DATABASE_URL;

  const normalized = normalizeDatabaseUrl(preferred);
  if (normalized) {
    process.env.DATABASE_URL = normalized;
  }
  return process.env.DATABASE_URL;
}
