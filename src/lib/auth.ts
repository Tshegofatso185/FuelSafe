import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type AppUser } from "@/db/schema";

export const SESSION_COOKIE = "fuelsafe_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// The app is often opened inside an embedded preview frame on another site.
// SameSite=None + Secure + Partitioned gives the cookie the best chance of
// being stored there. Some browsers still refuse every cookie in a frame, so
// the session token is also accepted from an Authorization header (see
// src/lib/client-auth.ts), which needs no cookies at all.
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  partitioned: true,
  path: "/",
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function newId(): string {
  return randomBytes(12).toString("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Creates a session, sets the cookie, and returns the token for header-based fallback. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ token, userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
  return token;
}

export const SESSION_HEADER = "x-fuelsafe-session";
export const SESSION_QUERY = "st";

/**
 * Reads the session token from, in order: the Authorization header, our own
 * X-FuelSafe-Session header, the `st` query parameter (API routes only), and
 * finally the cookie. Several channels exist because embedded previews may
 * block cookies and some proxies strip the Authorization header.
 */
async function readSessionToken(request?: Request): Promise<string | null> {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (TOKEN_PATTERN.test(bearer)) return bearer;
  }
  const custom = headerStore.get(SESSION_HEADER)?.trim();
  if (custom && TOKEN_PATTERN.test(custom)) return custom;
  if (request) {
    const fromQuery = new URL(request.url).searchParams.get(SESSION_QUERY)?.trim();
    if (fromQuery && TOKEN_PATTERN.test(fromQuery)) return fromQuery;
  }
  const store = await cookies();
  const cookieToken = store.get(SESSION_COOKIE)?.value;
  return cookieToken && TOKEN_PATTERN.test(cookieToken) ? cookieToken : null;
}

export async function getCurrentUser(request?: Request): Promise<AppUser | null> {
  const token = await readSessionToken(request);
  if (!token) return null;

  try {
    const [row] = await db
      .select({ id: users.id, name: users.name, email: users.email, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, token))
      .limit(1);

    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await db.delete(sessions).where(eq(sessions.token, token));
      return null;
    }
    return { id: row.id, name: row.name, email: row.email };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

export async function destroyCurrentSession(request?: Request): Promise<void> {
  const token = await readSessionToken(request);
  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      // Clearing the cookie matters more than the delete succeeding.
    }
  }
  const store = await cookies();
  // Deleting must reuse the same attributes, or a partitioned cookie survives.
  store.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}

/**
 * Because the cookie is SameSite=None, state-changing requests must prove they
 * came from our own scripts. Requiring a JSON content type forces a CORS
 * preflight for cross-site fetches and cannot be sent by a plain HTML form.
 */
export function isTrustedMutation(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}
