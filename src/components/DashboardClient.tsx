"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Fuel,
  Gauge,
  Info,
  LocateFixed,
  LoaderCircle,
  MapPin,
  LogOut,
  Menu,
  Navigation,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import YourCarQuestionnaire, { QuestionnaireCallout } from "@/components/YourCarQuestionnaire";
import { authFetch, setFallbackToken } from "@/lib/client-auth";
import FuelNowPanel from "@/components/FuelNowPanel";
import FuelBudgetPanel from "@/components/FuelBudgetPanel";
import {
  computeFuelMetrics,
  DEFAULT_PROFILE,
  getFuelOption,
  moneyFormat,
  numberFormat,
  resolvePriceForProfile,
  type FuelProfile,
  type PricePayload,
} from "@/lib/fuel";

type SaveState = "idle" | "saving" | "saved" | "error";

function getFuelShortLabel(value: FuelProfile["fuelType"]) {
  return getFuelOption(value).shortLabel;
}

export type DashboardUser = { id: string; name: string; email: string };

export default function DashboardClient({
  user,
  initialProfile,
  embedded = false,
  onSignedOut,
}: {
  user: DashboardUser;
  initialProfile: FuelProfile;
  /** True when running without cookies (session held in the page). */
  embedded?: boolean;
  onSignedOut?: () => void;
}) {
  const [profile, setProfile] = useState<FuelProfile>(initialProfile);
  const [prices, setPrices] = useState<PricePayload | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function loadPrices() {
      try {
        const response = await fetch("/api/fuel-prices", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load fuel prices.");
        const data = (await response.json()) as PricePayload;
        if (active) setPrices(data);
      } catch {
        if (active) setPriceError(true);
      } finally {
        if (active) setPricesLoading(false);
      }
    }

    void loadPrices();
    return () => {
      active = false;
    };
  }, []);

  // Turn location on as soon as the app opens (asks once per visit).
  useEffect(() => {
    locateDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(() => {
    return computeFuelMetrics(profile, resolvePriceForProfile(prices, profile));
  }, [profile, prices]);

  function updateProfile<K extends keyof FuelProfile>(field: K, value: FuelProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
    setSaveState("idle");
    setProfileError(null);
  }

  async function persistProfile(nextProfile: FuelProfile): Promise<boolean> {
    setSaveState("saving");
    setProfileError(null);

    try {
      const response = await authFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify(nextProfile),
      });
      const result = (await response.json()) as FuelProfile & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save this profile.");

      setProfile({ ...DEFAULT_PROFILE, ...result });
      setIsDirty(false);
      setSaveState("saved");
      setProfileError(null);
      if (!embedded) router.refresh();
      return true;
    } catch (error) {
      setSaveState("error");
      setProfileError(error instanceof Error ? error.message : "Unable to save this profile.");
      return false;
    }
  }

  function openVehicleEditor() {
    setQuestionnaireOpen(true);
    setMobileMenuOpen(false);
  }

  function handleQuestionnaireSaved(savedProfile: FuelProfile) {
    setProfile(savedProfile);
    setIsDirty(false);
    setSaveState("saved");
    setProfileError(null);
    setQuestionnaireOpen(false);
    if (!embedded) router.refresh();
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch {
      // Signing out locally still matters if the request fails.
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

  function locateDriver() {
    if (!navigator.geolocation) {
      setLocationMessage("Location sharing is not available in this browser.");
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const locationLabel = `Current location · ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
        updateProfile("locationLabel", locationLabel);
        setLocationMessage("Location on. We'll use it to show your range from where you are.");
        setIsLocating(false);
      },
      () => {
        setLocationMessage("Location is off. Turn it on in your browser to use your real position.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  }

  function refreshPrices() {
    setPricesLoading(true);
    setPriceError(false);
    fetch("/api/fuel-prices", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Price reference unavailable");
        const data = (await response.json()) as PricePayload;
        setPrices(data);
      })
      .catch(() => setPriceError(true))
      .finally(() => setPricesLoading(false));
  }

  const dateLabel = new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const fuelPercent = Math.min(100, Math.max(0, profile.fuelPercent));
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "FS";
  const estimated = !profile.tankCapacityVerified;
  const saveLabel = saveState === "saving"
    ? "Saving…"
    : saveState === "saved"
      ? "Saved"
      : isDirty
        ? "Save changes"
        : profile.saved
          ? "Saved to profile"
          : "Save profile";

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar${mobileMenuOpen ? " sidebar-open" : ""}`}>
        <a className="brand-lockup" href="#overview" onClick={() => setMobileMenuOpen(false)}>
          <span className="brand-mark"><Fuel size={21} strokeWidth={2.5} /></span>
          <span className="brand-name">fuel<span>safe</span><small>DRIVER’S COMPANION</small></span>
        </a>

        <div className="sidebar-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="side-link active" href="#overview" onClick={() => setMobileMenuOpen(false)}>
            <Gauge size={19} /><span>Overview</span><span className="active-indicator" />
          </a>
          <a className="side-link" href="#route" onClick={() => setMobileMenuOpen(false)}>
            <Navigation size={18} /><span>Range &amp; route</span>
          </a>
          <a className="side-link" href="#refill" onClick={() => setMobileMenuOpen(false)}>
            <Wallet size={18} /><span>Refill planner</span>
          </a>
          <button className="side-link" onClick={openVehicleEditor}>
            <CarFront size={19} /><span>Your car</span><span className="side-link-badge">{profile.saved ? "EDIT" : "SET UP"}</span>
          </button>
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-status-card">
          <div className="sidebar-status-top"><span className="status-dot" /> Fuel reading</div>
          <p>Connect over Bluetooth or enter your gauge reading.</p>
          <button onClick={() => { setMobileMenuOpen(false); document.getElementById("fuel-now-title")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
            Read my fuel <ArrowRight size={14} />
          </button>
        </div>

        <div className="sidebar-account">
          <span className="sidebar-account-avatar">{initials}</span>
          <span className="sidebar-account-copy"><strong>{firstName}</strong><small>{user.email}</small></span>
          <button onClick={handleSignOut} disabled={signingOut} aria-label="Sign out">
            {signingOut ? <LoaderCircle size={13} className="spin" /> : <LogOut size={13} />}
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="topbar-breadcrumb"><strong>Overview</strong></div>
          <div className="topbar-actions">
            <div className="topbar-location"><MapPin size={15} /><span>{profile.region === "inland" ? "Inland" : "Coastal"} · South Africa</span></div>
            <button className="profile-avatar" onClick={openVehicleEditor} aria-label="Edit vehicle profile" title={`${user.name} · ${user.email}`}>{initials}</button>
            <button className="signout-button" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? <LoaderCircle size={13} className="spin" /> : <LogOut size={13} />}
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <main className="dashboard-content" id="overview">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{dateLabel} <span>·</span> YOUR FUEL OVERVIEW</p>
              <h1>{greeting}, {firstName}.</h1>
              <p className="page-subtitle">A little more confidence in every kilometre.</p>
            </div>
            <button className="vehicle-summary-button" onClick={openVehicleEditor}>
              <span className="vehicle-summary-icon"><CarFront size={19} /></span>
              <span className="vehicle-summary-copy"><small>YOUR VEHICLE</small><strong>{profile.year} {profile.make} {profile.model}</strong></span>
              <Pencil size={15} className="vehicle-summary-edit" />
            </button>
          </div>

          {profileError && <div className="inline-alert" role="status"><AlertTriangle size={16} />{profileError}</div>}

          <section className="hero-card" aria-label="Estimated driving range">
            <div className="hero-copy">
              <div className="hero-kicker"><span className="hero-kicker-mark"><Sparkles size={13} /></span> YOUR RANGE SNAPSHOT</div>
              <h2>You have <span>{numberFormat(metrics.rangeKm)} km</span> of road ahead.</h2>
              <p>That’s an estimate based on <strong>{numberFormat(metrics.fuelLitres, 1)} litres</strong> in your tank and your saved driving consumption.</p>
              <div className="hero-bottom-row">
                <a className="hero-action" href="#route">See your safe-stop preview <ArrowRight size={16} /></a>
                <span className="hero-estimate-tag"><ShieldCheck size={15} /> Estimate, not a guarantee</span>
              </div>
            </div>
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <div className="hero-gauge-wrap" aria-label={`${fuelPercent}% fuel remaining`}>
              <svg className="hero-gauge" viewBox="0 0 144 144" aria-hidden="true">
                <circle className="hero-gauge-track" cx="72" cy="72" r="60" />
                <circle className="hero-gauge-progress" cx="72" cy="72" r="60" style={{ strokeDashoffset: `${377 - (377 * fuelPercent) / 100}` }} />
              </svg>
              <div className="hero-gauge-label"><strong>{numberFormat(fuelPercent)}<small>%</small></strong><span>FUEL LEFT</span></div>
              <span className="gauge-dot gauge-dot-one" /><span className="gauge-dot gauge-dot-two" />
            </div>
            <div className="hero-vehicle-tag"><CarFront size={16} /><span>{profile.make} {profile.model}</span><span className="hero-tag-year">{profile.year}</span></div>
          </section>

          {!profile.saved && (
            <QuestionnaireCallout
              heading="Let’s set up your car"
              copy="Five quick questions: your car, fuel grade, tank size, how you drive, and where you fill up."
              onOpen={openVehicleEditor}
            />
          )}

          <FuelNowPanel
            profile={profile}
            metrics={metrics}
            userName={firstName}
            onFuelUpdated={(nextFuelPercent) => {
              setProfile((current) => ({ ...current, fuelPercent: nextFuelPercent }));
              setIsDirty(false);
            }}
          />

          <section className="stat-grid" aria-label="Fuel estimates">
            <article className="stat-card stat-range">
              <div className="stat-card-top"><span className="stat-icon green"><Navigation size={17} /></span><span className="stat-title">LIKELY RANGE</span><span className="stat-corner"><CircleHelp size={15} /></span></div>
              <div className="stat-value-row"><strong>{numberFormat(metrics.rangeKm)}</strong><span>km</span></div>
              <div className="stat-footnote"><span className="stat-range-dot" />Likely band {numberFormat(metrics.rangeLow)}–{numberFormat(metrics.rangeHigh)} km</div>
            </article>
            <article className="stat-card stat-cost">
              <div className="stat-card-top"><span className="stat-icon yellow"><Wallet size={17} /></span><span className="stat-title">EST. REFILL TO FULL</span><span className="stat-corner"><CircleHelp size={15} /></span></div>
              <div className="stat-value-row"><strong>{metrics.refillCost === null ? "—" : moneyFormat(metrics.refillCost)}</strong></div>
              <div className="stat-footnote">{numberFormat(metrics.refillLitres, 1)} L at {metrics.pricePerLitre === null ? "an unavailable reference price" : `${moneyFormat(metrics.pricePerLitre, 2)}/L`}</div>
            </article>
            <article className="stat-card stat-fuel">
              <div className="stat-card-top"><span className="stat-icon peach"><Fuel size={17} /></span><span className="stat-title">FUEL ON BOARD</span><span className="stat-corner"><CircleHelp size={15} /></span></div>
              <div className="stat-value-row"><strong>{numberFormat(metrics.fuelLitres, 1)}</strong><span>L</span></div>
              <div className="stat-footnote">{numberFormat(fuelPercent)}% of {numberFormat(profile.tankCapacityLitres)} L capacity</div>
            </article>
          </section>

          <FuelBudgetPanel profile={profile} metrics={metrics} priceLoading={pricesLoading} />

          <div className="section-heading section-heading-route">
            <div><p className="eyebrow">YOUR NEXT MILE</p><h2>Range &amp; route</h2></div>
            <div className="heading-status"><span className="status-dot" />{profile.saved ? "Your car is set up" : "Setup needed"}</div>
          </div>

          <section className="route-layout" id="route">
            <RoutePreview
              locationLabel={profile.locationLabel}
              rangeKm={metrics.rangeKm}
              safeStopKm={metrics.safeStopKm}
              onLocate={locateDriver}
              isLocating={isLocating}
              locationMessage={locationMessage}
            />
            <div className="insight-stack">
              <article className="panel confidence-card">
                <div className="panel-heading compact-heading"><div><span className="small-icon"><Activity size={17} /></span><h3>How sure is this?</h3></div><CircleHelp size={16} className="muted-icon" /></div>
                <div className="confidence-range"><strong>{numberFormat(metrics.rangeLow)} km</strong><span className="confidence-track"><i /></span><strong>{numberFormat(metrics.rangeHigh)} km</strong></div>
                <p>We’ve added a <strong>±{Math.round(metrics.confidence * 100)}% range band</strong> around your estimate. Real range changes with traffic, hills, load and driving style.</p>
                <div className="confidence-foot"><span className="confidence-pill"><span /> CONFIDENCE</span><span>Medium</span></div>
              </article>

              <article className="panel efficiency-card">
                <div className="panel-heading compact-heading"><div><span className="small-icon lilac"><Zap size={17} /></span><h3>Vehicle efficiency</h3></div><button className="plain-icon-button" onClick={openVehicleEditor} aria-label="Edit vehicle efficiency"><Pencil size={15} /></button></div>
                <div className="efficiency-value"><strong>{numberFormat(profile.consumptionLPer100Km, 1)}</strong><span>L / 100 km</span></div>
                <p>Using saved consumption · {getFuelShortLabel(profile.fuelType)}</p>
                <div className="efficiency-foot"><span><span className="status-dot neutral" /> Manual estimate</span><button onClick={openVehicleEditor}>Edit <ArrowRight size={13} /></button></div>
              </article>

              <article className="data-source-card">
                <div className="source-icon"><Clock3 size={17} /></div>
                <div className="source-copy"><strong>Price reference</strong><span>{prices?.sourceName ?? "DMRE / CEF"}{prices?.publishedLabel ? ` · ${prices.publishedLabel}` : ""}</span></div>
                <button className="source-refresh" onClick={refreshPrices} aria-label="Refresh fuel price reference" disabled={pricesLoading}><RefreshCw size={15} className={pricesLoading ? "spin" : ""} /></button>
                {priceError && <p className="source-warning">Price service unavailable. Your last shown values may be stale.</p>}
              </article>
            </div>
          </section>

          <div className="section-heading section-heading-tools">
            <div><p className="eyebrow">IN YOUR CONTROL</p><h2>Plan your next refill</h2></div>
            <span className="manual-entry-note"><SlidersHorizontal size={14} /> Adjust any value to explore</span>
          </div>

          <section className="planner-layout" id="refill">
            <article className="panel simulator-card" id="fuel-controls">
              <div className="panel-heading">
                <div><span className="small-icon green"><Fuel size={17} /></span><div><h3>Adjust fuel level</h3><p>Drag to match your dashboard, or try a what-if level.</p></div></div>
              </div>
              <div className="fuel-level-display">
                <div><span className="fuel-level-label">CURRENT FUEL LEVEL</span><div className="fuel-level-number"><strong>{numberFormat(fuelPercent)}</strong><span>%</span></div></div>
                <div className="tank-capacity-mini"><span>IN TANK</span><strong>{numberFormat(metrics.fuelLitres, 1)} <small>L</small></strong></div>
              </div>
              <label className="range-slider-label" htmlFor="fuel-level-range">Drag to simulate a different fuel level</label>
              <input
                id="fuel-level-range"
                className="fuel-range-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={fuelPercent}
                aria-label="Fuel level percentage"
                aria-valuetext={`${fuelPercent}% fuel remaining`}
                style={{ background: `linear-gradient(90deg, #81a840 ${fuelPercent}%, #e7ebe4 ${fuelPercent}%)` }}
                onChange={(event) => updateProfile("fuelPercent", Number(event.currentTarget.value))}
              />
              <div className="slider-labels"><span>Empty</span><span>¼</span><span>½</span><span>¾</span><span>Full</span></div>
              <div className="fuel-control-row">
                <label className="input-with-unit"><span className="sr-only">Fuel percentage</span><input type="number" min="0" max="100" value={fuelPercent} onChange={(event) => updateProfile("fuelPercent", Math.min(100, Math.max(0, Number(event.currentTarget.value))))} /><span>%</span></label>
                <span className="fuel-control-hint">Tank capacity {numberFormat(profile.tankCapacityLitres)} L · {estimated ? "estimated" : "verified"}</span>
                <button className={`save-button${saveState === "saved" ? " save-button-saved" : ""}`} onClick={() => void persistProfile(profile)} disabled={!isDirty || saveState === "saving"}>
                  {saveState === "saving" ? <LoaderCircle size={15} className="spin" /> : saveState === "saved" ? <Check size={15} /> : <Save size={15} />}{saveLabel}
                </button>
              </div>
              {profileError && <p className="form-error" role="alert">{profileError}</p>}
              <div className="manual-entry-tip"><Info size={15} /><span>For your real fuel, use “Your fuel right now” above.</span><button onClick={openVehicleEditor}>Vehicle settings <ArrowRight size={13} /></button></div>
            </article>
          </section>

          <section className="footer-source-note">
            <span className="footer-note-mark"><ShieldCheck size={16} /></span>
            <p><strong>Estimates are for planning only.</strong> Always check your fuel gauge before you travel.</p>
          </section>
        </main>
      </div>

      {questionnaireOpen && (
        <YourCarQuestionnaire
          key={`${profile.id}-${profile.updatedAt ?? "draft"}-${questionnaireOpen}`}
          initialProfile={profile}
          profileSaved={profile.saved}
          onSaved={handleQuestionnaireSaved}
          onClose={() => setQuestionnaireOpen(false)}
        />
      )}
    </div>
  );
}

type RoutePreviewProps = {
  locationLabel: string;
  rangeKm: number;
  safeStopKm: number;
  onLocate: () => void;
  isLocating: boolean;
  locationMessage: string | null;
};

function RoutePreview({ locationLabel, rangeKm, safeStopKm, onLocate, isLocating, locationMessage }: RoutePreviewProps) {
  return (
    <article className="panel map-panel">
      <div className="panel-heading map-panel-heading">
        <div><span className="small-icon coral"><Compass size={17} /></span><div><h3>Safe-stop preview</h3><p>Where to fill up before you run low</p></div></div>
        <button className="locate-button" onClick={onLocate} disabled={isLocating}>{isLocating ? <LoaderCircle size={15} className="spin" /> : <LocateFixed size={15} />}{isLocating ? "Locating" : "Use my location"}</button>
      </div>
      <div className="route-map">
        <div className="map-caption"><span><MapPin size={13} />{locationLabel}</span></div>
        <svg className="map-art" viewBox="0 0 780 340" role="img" aria-label={`Schematic route. Safe stop recommended before the estimated ${numberFormat(rangeKm)} kilometre fuel-risk limit.`} preserveAspectRatio="xMidYMid slice">
          <rect width="780" height="340" fill="#e9efe5" />
          <path d="M0 64 208 8l94 0-228 87L0 111zM568 0l93 0-181 111-83 2zM0 305l112-74 54 8-139 101H0zM580 340l200-98v-51L521 340z" fill="#dfe9d8" />
          <path d="M35 0 141 340M240-20 315 360M468-20 540 360M705-40 626 380M-30 160 810 224M-20 82 805 139M-20 273 790 50" stroke="#fff" strokeWidth="16" fill="none" />
          <path d="M35 0 141 340M240-20 315 360M468-20 540 360M705-40 626 380M-30 160 810 224M-20 82 805 139M-20 273 790 50" stroke="#d4ddd2" strokeWidth="1.4" fill="none" />
          <path d="M70 265C139 248 169 236 216 228S313 215 359 185 446 176 485 153 552 113 598 115 655 130 704 102" stroke="#fff" strokeWidth="18" fill="none" strokeLinecap="round" />
          <path d="M70 265C139 248 169 236 216 228S313 215 359 185 446 176 485 153 552 113 598 115 655 130 704 102" stroke="#bac6bd" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M70 265C139 248 169 236 216 228S313 215 359 185 446 176 485 153 552 113 598 115 655 130 704 102" stroke="#1f4134" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M70 265C139 248 169 236 216 228S313 215 359 185 446 176 485 153" stroke="#c3e575" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M485 153C552 113 598 115 704 102" stroke="#e49a78" strokeWidth="5" strokeDasharray="7 8" fill="none" strokeLinecap="round" />
          <g className="map-road-label"><rect x="154" y="119" width="41" height="19" rx="5" fill="#fff" /><text x="174.5" y="132.5" textAnchor="middle">M1</text></g>
          <g className="map-road-label"><rect x="562" y="257" width="43" height="19" rx="5" fill="#fff" /><text x="583.5" y="270.5" textAnchor="middle">N3</text></g>
          <text className="map-place-label" x="82" y="55">PARKTOWN</text><text className="map-place-label" x="553" y="67">ROSEBANK</text><text className="map-place-label" x="303" y="304">JOHANNESBURG</text>
          <g className="map-station-pin" transform="translate(222 226)"><circle r="14" fill="#fff" /><circle r="11" fill="#fff" stroke="#799b50" strokeWidth="2" /><path d="M-3-4h5v8h-5zM2-3l3 2v4" fill="none" stroke="#476632" strokeWidth="1.3" strokeLinecap="round" /></g>
          <g className="map-station-pin" transform="translate(371 183)"><circle r="14" fill="#fff" /><circle r="11" fill="#fff" stroke="#799b50" strokeWidth="2" /><path d="M-3-4h5v8h-5zM2-3l3 2v4" fill="none" stroke="#476632" strokeWidth="1.3" strokeLinecap="round" /></g>
          <g className="map-stop-marker" transform="translate(485 153)"><circle r="17" fill="#d9f0aa" opacity=".62" /><circle r="10" fill="#f5ffe8" stroke="#59832c" strokeWidth="2.5" /><path d="m-4 0 3 3 5-6" fill="none" stroke="#426d22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
          <g className="map-risk-marker" transform="translate(704 102)"><circle r="20" fill="#f2b7a0" opacity=".45" /><circle r="11" fill="#fff6f1" stroke="#ca7255" strokeWidth="2.5" /><path d="M0-6v7M0 4v1" stroke="#b25740" strokeWidth="2" strokeLinecap="round" /></g>
          <g className="map-start-marker" transform="translate(70 265)"><circle r="22" fill="#c3e575" opacity=".35" /><circle r="12" fill="#243f32" stroke="#fff" strokeWidth="3" /><circle r="3" fill="#eff8dd" /></g>
          <g className="map-tag" transform="translate(47 292)"><rect width="82" height="24" rx="7" fill="#243f32" /><text x="41" y="16" textAnchor="middle" fill="#fff">YOU ARE HERE</text></g>
          <g className="map-tag" transform="translate(443 103)"><rect width="103" height="25" rx="7" fill="#f8fff1" stroke="#c1d5a8" /><text x="51.5" y="16" textAnchor="middle" fill="#375d2a">SAFE STOP</text></g>
          <g className="map-tag map-tag-risk" transform="translate(655 57)"><rect width="88" height="25" rx="7" fill="#fff6f1" stroke="#e6c3b4" /><text x="44" y="16" textAnchor="middle" fill="#994f3b">RANGE LIMIT</text></g>
        </svg>
        <div className="map-legend"><span><i className="legend-start" />Your start</span><span><i className="legend-stop" />Recommended stop</span><span><i className="legend-risk" />Estimated limit</span></div>
      </div>
      <div className="route-plan-row">
        <div className="route-plan-icon"><Navigation size={17} /></div>
        <div className="route-plan-copy"><strong>Plan to stop around {numberFormat(safeStopKm)} km</strong><span>A safe buffer before your estimated {numberFormat(rangeKm)} km range limit.</span></div>
        <div className="route-plan-distance"><strong>{numberFormat(rangeKm)}<small> km</small></strong><span>EST. RANGE</span></div>
      </div>
      {locationMessage && <p className="location-message" role="status"><Info size={14} />{locationMessage}</p>}
    </article>
  );
}
