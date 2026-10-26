import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleProfiles, type FuelType, type PricingRegion } from "@/db/schema";
import { getCurrentUser, isTrustedMutation } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isFuelType(value: unknown): value is FuelType {
  return (
    value === "petrol_93" ||
    value === "petrol_95" ||
    value === "diesel_500ppm" ||
    value === "diesel_50ppm"
  );
}

function isRegion(value: unknown): value is PricingRegion {
  return value === "inland" || value === "coastal";
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in to view your car." }, { status: 401 });

  try {
    const [profile] = await db
      .select()
      .from(vehicleProfiles)
      .where(eq(vehicleProfiles.id, user.id))
      .limit(1);

    if (!profile) {
      return Response.json({ saved: false, setupComplete: false, userId: user.id });
    }
    return Response.json({ ...profile, updatedAt: profile.updatedAt.toISOString(), saved: true });
  } catch {
    return Response.json({ error: "Unable to load your car profile." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in to save your car." }, { status: 401 });
  if (!isTrustedMutation(request)) {
    return Response.json({ error: "Send the profile as JSON." }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON profile." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "The vehicle profile is invalid." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const make = typeof record.make === "string" ? record.make.trim() : "";
  const model = typeof record.model === "string" ? record.model.trim() : "";
  const locationLabel = typeof record.locationLabel === "string" ? record.locationLabel.trim() : "";
  const year = Number(record.year);
  const tankCapacityLitres = Number(record.tankCapacityLitres);
  const tankCapacityVerified = record.tankCapacityVerified;
  const fuelPercent = Number(record.fuelPercent);
  const consumptionLPer100Km = Number(record.consumptionLPer100Km);
  const { fuelType, region } = record;

  if (!make || make.length > 80 || !model || model.length > 100) {
    return Response.json({ error: "Enter a make and model (up to 80 and 100 characters)." }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    return Response.json({ error: "Enter a valid model year." }, { status: 400 });
  }
  if (!isFuelType(fuelType)) {
    return Response.json({ error: "Choose a supported South African fuel type." }, { status: 400 });
  }
  if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres < 10 || tankCapacityLitres > 200) {
    return Response.json({ error: "Tank capacity must be between 10 and 200 litres." }, { status: 400 });
  }
  if (typeof tankCapacityVerified !== "boolean") {
    return Response.json({ error: "Specify whether tank capacity is verified." }, { status: 400 });
  }
  if (!Number.isFinite(fuelPercent) || fuelPercent < 0 || fuelPercent > 100) {
    return Response.json({ error: "Fuel level must be between 0% and 100%." }, { status: 400 });
  }
  if (!Number.isFinite(consumptionLPer100Km) || consumptionLPer100Km < 2 || consumptionLPer100Km > 40) {
    return Response.json({ error: "Consumption must be between 2 and 40 L/100 km." }, { status: 400 });
  }
  if (!isRegion(region)) {
    return Response.json({ error: "Choose Inland or Coastal pricing." }, { status: 400 });
  }
  if (!locationLabel || locationLabel.length > 120) {
    return Response.json({ error: "Enter a location label (up to 120 characters)." }, { status: 400 });
  }

  const values = {
    id: user.id,
    make,
    model,
    year,
    fuelType,
    tankCapacityLitres,
    tankCapacityVerified,
    fuelPercent,
    consumptionLPer100Km,
    region,
    locationLabel,
    setupComplete: true,
    updatedAt: new Date(),
  };

  try {
    const [profile] = await db
      .insert(vehicleProfiles)
      .values(values)
      .onConflictDoUpdate({ target: vehicleProfiles.id, set: values })
      .returning();

    return Response.json({ ...profile, updatedAt: profile.updatedAt.toISOString(), saved: true });
  } catch {
    return Response.json({ error: "Unable to save your car. Try again." }, { status: 500 });
  }
}
