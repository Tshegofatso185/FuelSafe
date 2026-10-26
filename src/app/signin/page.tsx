import { redirect } from "next/navigation";
import SignInForm from "@/components/SignInForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — FuelSafe",
  description: "Sign in to your FuelSafe fuel range and refill assistant.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const resetToken = params.reset && /^[0-9a-f]{64}$/.test(params.reset) ? params.reset : null;

  // A reset link should open the reset form even if a session exists.
  const user = resetToken ? null : await getCurrentUser();
  if (user) redirect("/");

  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/";
  return <SignInForm nextPath={nextPath} initialResetToken={resetToken} />;
}
