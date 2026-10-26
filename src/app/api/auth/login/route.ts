import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, vehicleProfiles } from "@/db/schema";
import { createSession, isTrustedMutation, normalizeEmail, verifyPassword } from "@/lib/auth";

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
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    const [account] = await db
      .select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!account) {
      return Response.json(
        { error: "There's no FuelSafe account for that email yet.", code: "no_account" },
        { status: 401 },
      );
    }
    if (!verifyPassword(password, account.passwordHash)) {
      return Response.json(
        { error: "That password isn't right. Check it and try again.", code: "bad_password" },
        { status: 401 },
      );
    }

    const token = await createSession(account.id);

    const [profile] = await db
      .select({ id: vehicleProfiles.id })
      .from(vehicleProfiles)
      .where(eq(vehicleProfiles.id, account.id))
      .limit(1);

    return Response.json({
      ok: true,
      user: { id: account.id, name: account.name, email: account.email },
      hasProfile: Boolean(profile),
      token,
    });
  } catch {
    return Response.json({ error: "Sign-in is unavailable right now. Try again." }, { status: 500 });
  }
}
