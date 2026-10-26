import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, sessions, users, vehicleProfiles } from "@/db/schema";
import { createSession, hashPassword, isTrustedMutation } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Completes a reset: sets the new password, signs out everywhere, signs in here. */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return Response.json({ error: "Send the request as JSON." }, { status: 415 });
  }
  let token = "";
  let password = "";
  try {
    const body = (await request.json()) as { token?: unknown; password?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return Response.json({ error: "This reset link is invalid. Ask for a new one." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  }

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [reset] = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, tokenHash)).limit(1);
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      return Response.json({ error: "This reset link has expired or was already used. Ask for a new one." }, { status: 400 });
    }

    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.tokenHash, tokenHash));
    await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, reset.userId));
    // Any session opened with the old password is ended.
    await db.delete(sessions).where(eq(sessions.userId, reset.userId));

    const [account] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, reset.userId))
      .limit(1);
    const [car] = await db.select({ id: vehicleProfiles.id }).from(vehicleProfiles).where(eq(vehicleProfiles.id, reset.userId)).limit(1);
    const sessionToken = await createSession(reset.userId);

    return Response.json({ ok: true, user: account, hasProfile: Boolean(car), token: sessionToken });
  } catch {
    return Response.json({ error: "We couldn't reset your password. Try again." }, { status: 500 });
  }
}
