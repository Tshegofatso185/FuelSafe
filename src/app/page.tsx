import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vehicleProfiles } from "@/db/schema";
import DashboardClient from "@/components/DashboardClient";
import { requireUser } from "@/lib/auth";
import { DEFAULT_PROFILE, type FuelProfile } from "@/lib/fuel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();

  let profile: FuelProfile = { ...DEFAULT_PROFILE };
  try {
    const [row] = await db
      .select()
      .from(vehicleProfiles)
      .where(eq(vehicleProfiles.id, user.id))
      .limit(1);
    if (row) {
      profile = { ...row, updatedAt: row.updatedAt.toISOString(), saved: true };
    }
  } catch {
    profile = { ...DEFAULT_PROFILE };
  }

  // Drivers who haven't finished the car setup are sent to the welcome flow.
  if (!profile.saved) redirect("/welcome");

  return <DashboardClient user={user} initialProfile={profile} />;
}
