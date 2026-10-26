"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DashboardClient from "@/components/DashboardClient";
import WelcomeFlow from "@/components/WelcomeFlow";
import { authFetch } from "@/lib/client-auth";
import { DEFAULT_PROFILE, type FuelProfile } from "@/lib/fuel";

type User = { id: string; name: string; email: string };

/**
 * Runs the signed-in experience without page navigation, for browsers that
 * refuse to store our session cookie. The session token is sent as a header.
 */
export default function InPageApp({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [profile, setProfile] = useState<FuelProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setError(null);
    try {
      const response = await authFetch("/api/profile");
      if (response.status === 401) {
        setError("The preview didn't pass your session along (401). Try again, or open FuelSafe in a new tab.");
        return;
      }
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = (await response.json()) as Partial<FuelProfile> & { saved?: boolean };
      setProfile(data.saved ? { ...DEFAULT_PROFILE, ...data, saved: true } : { ...DEFAULT_PROFILE, saved: false });
    } catch {
      setError("We couldn't load your car profile.");
    }
  }, [onSignedOut]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (error) {
    return (
      <main className="inpage-status">
        <p>{error}</p>
        <button onClick={() => void loadProfile()}><RefreshCw size={14} /> Try again</button>
        <button className="inpage-secondary" onClick={onSignedOut}>Back to sign in</button>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="inpage-status">
        <LoaderCircle size={20} className="spin" />
        <p>Opening your fuel dashboard…</p>
      </main>
    );
  }

  if (!profile.saved) {
    return (
      <WelcomeFlow
        user={user}
        profile={profile}
        onComplete={(saved) => setProfile({ ...saved, saved: true })}
        onSignedOut={onSignedOut}
      />
    );
  }

  return <DashboardClient user={user} initialProfile={profile} embedded onSignedOut={onSignedOut} />;
}
