import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { fuelReadings, passwordResets, users, vehicleProfiles } from "@/db/schema";
import { isTrustedMutation, normalizeEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RESET_TTL_MS = 30 * 60 * 1000;

async function sendResetEmail(to: string, name: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.RESET_EMAIL_FROM || "FuelSafe <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "Reset your FuelSafe password",
        text: `Hi ${name},\n\nUse this link within 30 minutes to choose a new FuelSafe password:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Starts a password reset.
 * - Accounts holding personal data (a saved car or fuel readings) can only be
 *   reset through an emailed link, so nobody can take them over just by
 *   knowing the email address.
 * - Accounts with nothing saved yet have no private data, so the reset code is
 *   returned directly. That's no more access than registering the email fresh.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return Response.json({ error: "Send the request as JSON." }, { status: 415 });
  }
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  if (!email) return Response.json({ error: "Enter the email you signed up with." }, { status: 400 });

  try {
    const [account] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!account) {
      return Response.json({ ok: true, mode: "no_account" });
    }

    const [car] = await db.select({ id: vehicleProfiles.id }).from(vehicleProfiles).where(eq(vehicleProfiles.id, account.id)).limit(1);
    const [reading] = await db.select({ id: fuelReadings.id }).from(fuelReadings).where(eq(fuelReadings.userId, account.id)).limit(1);
    const holdsData = Boolean(car || reading);

    // Invalidate any earlier unused codes for this account.
    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, account.id), isNull(passwordResets.usedAt)));

    const code = randomBytes(32).toString("hex");
    await db.insert(passwordResets).values({
      tokenHash: createHash("sha256").update(code).digest("hex"),
      userId: account.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });

    if (!holdsData) {
      return Response.json({ ok: true, mode: "instant", resetToken: code });
    }

    const origin = request.headers.get("origin") || new URL(request.url).origin;
    const sent = await sendResetEmail(account.email, account.name, `${origin}/signin?reset=${code}`);
    return Response.json({ ok: true, mode: sent ? "email" : "unavailable" });
  } catch {
    return Response.json({ error: "Password reset is unavailable right now. Try again." }, { status: 500 });
  }
}
