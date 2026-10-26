import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, isTrustedMutation, isValidEmail, newId, normalizeEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return Response.json({ error: "Send the request as JSON." }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "The request is invalid." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: "Enter your name (2–80 characters)." }, { status: 400 });
  }
  if (!isValidEmail(email) || email.length > 160) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  }

  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return Response.json({ error: "That email already has an account. Sign in instead." }, { status: 409 });
    }

    const [created] = await db
      .insert(users)
      .values({ id: newId(), name, email, passwordHash: hashPassword(password) })
      .returning({ id: users.id, name: users.name, email: users.email });

    const token = await createSession(created.id);
    return Response.json({ ok: true, user: created, hasProfile: false, token });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    return Response.json({ error: "We couldn't create your account. Try again." }, { status: 500 });
  }
}
