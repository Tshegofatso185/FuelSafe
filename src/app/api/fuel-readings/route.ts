import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fuelReadings, vehicleProfiles, type ReadingSource } from "@/db/schema";
import { getCurrentUser, isTrustedMutation, newId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private" };

function serialize(row: typeof fuelReadings.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function isSource(value: unknown): value is ReadingSource {
  return value === "obd" || value === "manual" || value === "demo";
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in to view your fuel readings." }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(fuelReadings)
      .where(eq(fuelReadings.userId, user.id))
      .orderBy(desc(fuelReadings.createdAt))
      .limit(10);
    return Response.json({ readings: rows.map(serialize) }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "Unable to load fuel readings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in to save a fuel reading." }, { status: 401 });
  if (!isTrustedMutation(request)) {
    return Response.json({ error: "Send the reading as JSON." }, { status: 415 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a valid JSON reading." }, { status: 400 });
  }

  const fuelPercent = Number(body.fuelPercent);
  const source = body.source;
  const adapterName =
    typeof body.adapterName === "string" && body.adapterName.trim() ? body.adapterName.trim().slice(0, 80) : null;

  if (!Number.isFinite(fuelPercent) || fuelPercent < 0 || fuelPercent > 100) {
    return Response.json({ error: "Fuel level must be between 0% and 100%." }, { status: 400 });
  }
  if (!isSource(source)) {
    return Response.json({ error: "Unknown reading source." }, { status: 400 });
  }
  if (source === "demo") {
    return Response.json({ error: "Demo readings are previews and cannot replace your car's fuel level." }, { status: 400 });
  }

  try {
    const [profile] = await db
      .select({ tank: vehicleProfiles.tankCapacityLitres })
      .from(vehicleProfiles)
      .where(eq(vehicleProfiles.id, user.id))
      .limit(1);
    if (!profile) {
      return Response.json({ error: "Set up your car before saving a fuel reading." }, { status: 409 });
    }

    const rounded = Math.round(fuelPercent * 10) / 10;
    const [reading] = await db
      .insert(fuelReadings)
      .values({
        id: newId(),
        userId: user.id,
        fuelPercent: rounded,
        litres: Math.round(((profile.tank * rounded) / 100) * 10) / 10,
        source,
        adapterName,
      })
      .returning();

    // The latest reading becomes the car's current fuel level.
    await db
      .update(vehicleProfiles)
      .set({ fuelPercent: rounded, updatedAt: new Date() })
      .where(eq(vehicleProfiles.id, user.id));

    return Response.json({ reading: serialize(reading) }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "Unable to save this reading. Try again." }, { status: 500 });
  }
}
