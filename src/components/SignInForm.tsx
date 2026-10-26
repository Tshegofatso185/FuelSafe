"use client";

import { Eye, EyeOff, Fuel, LoaderCircle, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import InPageApp from "@/components/InPageApp";
import { authFetch, getFallbackToken, setFallbackToken } from "@/lib/client-auth";

type Mode = "signin" | "signup" | "forgot" | "reset";
type SessionUser = { id: string; name: string; email: string };

async function checkSession(): Promise<SessionUser | null> {
  try {
    const response = await authFetch("/api/auth/session");
    const data = (await response.json()) as { signedIn?: boolean; user?: SessionUser | null };
    return data.signedIn && data.user ? data.user : null;
  } catch {
    return null;
  }
}

export default function SignInForm({
  nextPath,
  initialResetToken = null,
}: {
  nextPath: string;
  initialResetToken?: string | null;
}) {
  const router = useRouter();
  // Set when the browser blocks cookies: the app then runs on this page.
  const [inPageUser, setInPageUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  // A reload in the same tab can restore an in-page session from sessionStorage.
  useEffect(() => {
    let active = true;
    if (!getFallbackToken()) {
      setRestoring(false);
      return;
    }
    void checkSession().then((user) => {
      if (!active) return;
      if (user) setInPageUser(user);
      else setFallbackToken(null);
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleInPageSignOut = useCallback(() => {
    setFallbackToken(null);
    setInPageUser(null);
  }, []);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState<string | null>(initialResetToken);

  useEffect(() => {
    if (initialResetToken) setMode("reset");
  }, [initialResetToken]);

  /** Shared ending for sign-in, sign-up and password reset. */
  async function finishAuth(result: { token?: string; user?: SessionUser; hasProfile?: boolean }) {
    // Did the browser keep the cookie? Check without the header fallback.
    setFallbackToken(null);
    const cookieSession = await checkSession();
    if (!cookieSession) {
      if (result.token && result.user) {
        setFallbackToken(result.token);
        setPassword("");
        setSubmitting(false);
        setInPageUser(result.user);
        return;
      }
      setCookieBlocked(true);
      setSubmitting(false);
      return;
    }
    router.replace(result.hasProfile ? nextPath || "/" : "/welcome");
    router.refresh();
  }

  async function handleForgot() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter the email you signed up with.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const result = (await response.json()) as { mode?: string; resetToken?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Password reset is unavailable right now.");
      if (result.mode === "no_account") {
        setErrorCode("no_account");
        setError("There's no FuelSafe account for that email yet.");
      } else if (result.mode === "instant" && result.resetToken) {
        setResetCode(result.resetToken);
        setPassword("");
        setMode("reset");
        setNotice("Your account has no car saved yet, so you can choose a new password right away.");
      } else if (result.mode === "email") {
        setNotice("We've emailed you a reset link. It works for 30 minutes.");
      } else {
        setError("This account has a saved car, so we can only reset it by email, and email isn't set up in this demo yet. Try your usual passwords, or contact support.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password reset is unavailable right now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: resetCode, password }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        token?: string;
        user?: SessionUser;
        hasProfile?: boolean;
      };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "We couldn't reset your password.");
      setResetCode(null);
      await finishAuth(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't reset your password.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setCookieBlocked(false);
    setNotice(null);

    if (mode === "forgot") return handleForgot();
    if (mode === "reset") return handleReset();

    const trimmedEmail = email.trim();
    if (mode === "signup" && name.trim().length < 2) {
      setError("Enter your name (at least 2 characters).");
      return;
    }
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          mode === "signup" ? { name, email: trimmedEmail, password } : { email: trimmedEmail, password },
        ),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        hasProfile?: boolean;
        error?: string;
        code?: string;
        token?: string;
        user?: SessionUser;
      };
      if (!response.ok || !result.ok) {
        setErrorCode(result.code ?? (response.status === 409 ? "exists" : null));
        throw new Error(result.error ?? "We couldn't sign you in. Try again.");
      }

      await finishAuth(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't sign you in. Try again.");
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setErrorCode(null);
    setCookieBlocked(false);
    setNotice(null);
  }

  const heading = {
    signin: "Welcome back",
    signup: "Let’s get you set up",
    forgot: "Reset your password",
    reset: "Choose a new password",
  }[mode];
  const intro = {
    signin: "Sign in to open your fuel dashboard.",
    signup: "We’ll ask a few questions about your car next.",
    forgot: "Enter the email you signed up with and we’ll help you back in.",
    reset: "Pick a password of at least 8 characters. You’ll be signed in straight after.",
  }[mode];
  const submitLabel = submitting
    ? { signin: "Signing in…", signup: "Creating your account…", forgot: "Checking…", reset: "Saving…" }[mode]
    : { signin: "Sign in", signup: "Create account & continue", forgot: "Reset password", reset: "Save new password & sign in" }[mode];


  if (inPageUser) {
    return <InPageApp user={inPageUser} onSignedOut={handleInPageSignOut} />;
  }

  if (restoring) {
    return (
      <main className="inpage-status">
        <LoaderCircle size={20} className="spin" />
        <p>Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <span className="auth-hero-mark"><Fuel size={20} strokeWidth={2.5} /></span>
        <p className="auth-hero-eyebrow">FUELSAFE · SOUTH AFRICA</p>
        <h1>Know your fuel before the road decides for you.</h1>
        <p className="auth-hero-copy">
          Sign in to see how many litres you have, how far that takes you, what a full tank will cost, and
          where to stop safely.
        </p>
        <ul className="auth-hero-points">
          <li><ShieldCheck size={15} /> Estimates shown with an honest confidence band</li>
          <li><Fuel size={15} /> Tank size suggested from your exact car model</li>
          <li><LockKeyhole size={15} /> Your car profile stays private to your account</li>
        </ul>
        <p className="auth-hero-foot">Only you can see your vehicle details.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Choose an option">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : undefined}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : undefined}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>

          <h2>{heading}</h2>
          <p className="auth-intro">{intro}</p>
          {notice && <div className="auth-alert auth-alert-success" role="status"><span>{notice}</span></div>}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === "signup" && (
              <label>
                <span>Your name</span>
                <span className="auth-input">
                  <User size={15} />
                  <input
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    placeholder="e.g. Thandi Mokoena"
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </span>
              </label>
            )}

            {mode !== "reset" && (
            <label>
              <span>Email</span>
              <span className="auth-input">
                <Mail size={15} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={160}
                  required
                />
              </span>
            </label>
            )}

            {mode !== "forgot" && (
              <label>
                <span className="auth-label-row">
                  {mode === "reset" ? "New password" : "Password"}
                  {mode === "signin" && (
                    <button type="button" className="auth-forgot" onClick={() => switchMode("forgot")}>
                      Forgot password?
                    </button>
                  )}
                </span>
                <span className="auth-input">
                  <LockKeyhole size={15} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                    onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                    onBlur={() => setCapsLock(false)}
                    placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
                {capsLock && <span className="auth-caps">Caps Lock is on</span>}
              </label>
            )}

            {error && (
              <div className="auth-alert" role="alert">
                <span>{error}</span>
                {errorCode === "no_account" && (
                  <button type="button" onClick={() => switchMode("signup")}>Create an account with this email</button>
                )}
                {errorCode === "exists" && (
                  <>
                    <button type="button" onClick={() => switchMode("signin")}>Sign in instead</button>
                    <button type="button" onClick={() => switchMode("forgot")}>Forgot your password?</button>
                  </>
                )}
                {errorCode === "bad_password" && (
                  <button type="button" onClick={() => switchMode("forgot")}>Forgot your password? Reset it</button>
                )}
              </div>
            )}

            {cookieBlocked && (
              <div className="auth-alert auth-alert-warning" role="alert">
                <span>
                  Your details are correct, but this preview didn&apos;t keep your session. Please reload the
                  preview and try once more — your account is already saved.
                </span>
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting && <LoaderCircle size={15} className="spin" />}
              {submitLabel}
            </button>

            <p className="auth-switch-copy">
              {mode === "signin" ? "New to FuelSafe? " : mode === "signup" ? "Already have an account? " : "Remembered it? "}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create an account" : "Back to sign in"}
              </button>
            </p>
          </form>
        </div>
        <p className="auth-note">
          This is a demo MVP. Please use a password you don’t reuse elsewhere.
        </p>
      </section>
    </main>
  );
}
