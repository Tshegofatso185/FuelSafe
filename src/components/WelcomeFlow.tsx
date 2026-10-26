"use client";

import { ArrowRight, CarFront, CircleAlert, LoaderCircle, LogOut, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import YourCarQuestionnaire, { QuestionnaireCallout } from "@/components/YourCarQuestionnaire";
import type { FuelProfile } from "@/lib/fuel";
import { authFetch, setFallbackToken } from "@/lib/client-auth";

export default function WelcomeFlow({
  user,
  profile,
  onComplete,
  onSignedOut,
}: {
  user: { id: string; name: string; email: string };
  profile: FuelProfile;
  /** In-page mode (no cookies): hand the saved car back instead of navigating. */
  onComplete?: (profile: FuelProfile) => void;
  onSignedOut?: () => void;
}) {
  const router = useRouter();
  const [savedProfile, setSavedProfile] = useState<FuelProfile | null>(
    profile.saved ? profile : null,
  );
  const [started, setStarted] = useState(!profile.saved);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  function goToDashboard(next: FuelProfile) {
    if (onComplete) {
      onComplete(next);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  function handleSaved(next: FuelProfile) {
    setSavedProfile(next);
    setStarted(false);
    goToDashboard(next);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch {
      // Still sign out locally.
    } finally {
      setFallbackToken(null);
      if (onSignedOut) {
        onSignedOut();
      } else {
        router.replace("/signin");
        router.refresh();
      }
    }
  }

  return (
    <main className="welcome-shell">
      <header className="welcome-topbar">
        <span className="welcome-brand">fuel<span>safe</span></span>
        <button className="welcome-signout" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? <LoaderCircle size={13} className="spin" /> : <LogOut size={13} />}
          Sign out
        </button>
      </header>

      <section className="welcome-hero">
        <span className="welcome-halo" aria-hidden="true" />
        <p className="welcome-eyebrow">STEP 1 OF 1 · CAR SETUP</p>
        <h1>Welcome, {firstName}</h1>
        <p className="welcome-lede">
          Let’s set your car up so FuelSafe can analyse your current petrol level. Answer five short
          questions and your dashboard will show litres on board, how far they’ll take you, the cost to
          refill, and where to stop safely.
        </p>
        <ul className="welcome-points">
          <li><CarFront size={15} /> We suggest a tank size from your exact model</li>
          <li><Sparkles size={15} /> You can correct anything we get wrong</li>
        </ul>
      </section>

      {error && (
        <p className="form-error welcome-error" role="alert"><CircleAlert size={14} /> {error}</p>
      )}

      {started ? (
        <YourCarQuestionnaire
          initialProfile={profile}
          profileSaved={profile.saved}
          variant="page"
          onSaved={handleSaved}
          onClose={() => setStarted(false)}
        />
      ) : savedProfile ? (
        <div className="welcome-done">
          <span className="welcome-done-icon"><Sparkles size={18} /></span>
          <strong>Your car is ready</strong>
          <span>
            {savedProfile.year} {savedProfile.make} {savedProfile.model} ·{" "}
            {savedProfile.tankCapacityLitres} L tank
          </span>
          <button onClick={() => goToDashboard(savedProfile)}>
            Open my dashboard <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <QuestionnaireCallout
          heading="Start with your car"
          copy="Make, model and year are all we need to begin."
          onOpen={() => setStarted(true)}
        />
      )}

      <p className="welcome-footnote">
        You can change these details any time from the sidebar under “Car questionnaire”.
      </p>
    </main>
  );
}
