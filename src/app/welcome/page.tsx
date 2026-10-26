import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vehicleProfiles } from "@/db/schema";
import WelcomeFlow from "@/components/WelcomeFlow";
import { requireUser } from "@/lib/auth";
import { DEFAULT_PROFILE, type FuelProfile } from "@/lib/fuel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome — FuelSafe",
  description: "Set up your car so FuelSafe can analyse your fuel level and range.",
};

export default async function WelcomePage() {
  const user = await requireUser();

  let profile: FuelProfile = { ...DEFAULT_PROFILE };
  try {
    const [row] = await db
      .select()
      .from(vehicleProfiles)
      .where(eq(vehicleProfiles.id, user.id))
      .limit(1);
    if (row) profile = { ...row, updatedAt: row.updatedAt.toISOString(), saved: true };
  } catch {
    profile = { ...DEFAULT_PROFILE };
  }

  return <WelcomeFlow user={user} profile={profile} />;
}
