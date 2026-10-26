import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization, X-FuelSafe-Session",
};

// Lets the sign-in screen confirm whether the browser kept the session.
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  return Response.json({ signedIn: Boolean(user), user }, { headers: NO_STORE });
}
