"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CarFront,
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  Fuel,
  Gauge,
  Info,
  LoaderCircle,
  MapPin,
  PencilLine,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  computeFuelMetrics,
  DEFAULT_PROFILE,
  FUEL_OPTIONS,
  getFuelOption,
  moneyFormat,
  numberFormat,
  type FuelProfile,
  type FuelType,
  type PricePayload,
  type PricingRegion,
} from "@/lib/fuel";
import { BODY_STYLE_DEFAULTS, CURRENT_YEAR, OTHER_VEHICLE, type VehicleSpecMatch } from "@/lib/vehicle-specs";
import { authFetch } from "@/lib/client-auth";

type QuestionnaireProps = {
  initialProfile: FuelProfile;
  profileSaved: boolean;
  /** Provided on the dashboard, where saved answers update live state. */
  onSaved?: (profile: FuelProfile) => void;
  onClose?: () => void;
  variant?: "overlay" | "page";
};

type Catalogue = {
  makes: string[];
  modelsByMake: Record<string, string[]>;
  years: number[];
  disclaimer: string;
};

const STEP_LABELS = ["Your car", "Fuel & tank", "How you drive", "Where you fill up", "Your setup"];

const DRIVING_STYLES: { id: string; label: string; description: string; factor: number }[] = [
  { id: "city", label: "Mostly city", description: "Traffic, robots, short trips", factor: 1.25 },
  { id: "mixed", label: "Mixed", description: "A blend of town and highway", factor: 1 },
  { id: "highway", label: "Mostly highway", description: "Longer, steadier distances", factor: 0.85 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function YourCarQuestionnaire({
  initialProfile,
  profileSaved,
  onSaved,
  onClose,
  variant = "overlay",
}: QuestionnaireProps) {
  const [draft, setDraft] = useState<FuelProfile>({ ...DEFAULT_PROFILE, ...initialProfile });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [specMatch, setSpecMatch] = useState<VehicleSpecMatch | null>(null);
  const [specLookup, setSpecLookup] = useState<"idle" | "loading" | "miss">("idle");
  const [tankManuallyEdited, setTankManuallyEdited] = useState(false);
  const [prices, setPrices] = useState<PricePayload | null>(null);
  // True when the driver is typing a car we don't have in the autofill list.
  const [manualVehicle, setManualVehicle] = useState(initialProfile.make === OTHER_VEHICLE);
  const [bodyStyle, setBodyStyle] = useState<string | null>(null);
  const router = useRouter();

  const modelOptions = useMemo(
    () => (draft.make && draft.make !== OTHER_VEHICLE ? catalogue?.modelsByMake[draft.make] ?? [] : []),
    [catalogue, draft.make],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/vehicle-specs", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as Catalogue;
      })
      .then((data) => {
        if (active) setCatalogue(data);
      })
      .catch(() => {
        if (active) setCatalogueError("Vehicle-spec lookup is offline. Enter your details manually.");
      });
    fetch("/api/fuel-prices", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as PricePayload;
      })
      .then((data) => {
        if (active) setPrices(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Once the catalogue loads, decide whether a saved car is a manual one, and
  // tidy up the old "Other / not listed" sentinel so the make reads cleanly.
  useEffect(() => {
    if (!catalogue) return;
    if (draft.make === OTHER_VEHICLE) {
      setManualVehicle(true);
      setDraft((current) => ({ ...current, make: "" }));
    } else if (draft.make && !catalogue.makes.includes(draft.make)) {
      setManualVehicle(true);
    }
  }, [catalogue, draft.make]);

  // Auto-fill tank size, consumption and fuel grade whenever the identified car changes.
  useEffect(() => {
    if (manualVehicle || !draft.make || draft.make === OTHER_VEHICLE || !draft.model) {
      setSpecMatch(null);
      setSpecLookup("idle");
      return;
    }
    let active = true;
    setSpecLookup("loading");
    const params = new URLSearchParams({ make: draft.make, model: draft.model, year: String(draft.year) });
    fetch(`/api/vehicle-specs?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as { match: VehicleSpecMatch | null };
      })
      .then((data) => {
        if (!active) return;
        setSpecMatch(data.match);
        setSpecLookup(data.match ? "idle" : "miss");
        if (data.match && !tankManuallyEdited) {
          setDraft((current) => ({
            ...current,
            tankCapacityLitres: data.match!.tankCapacityLitres,
            consumptionLPer100Km: data.match!.consumptionLPer100Km,
            fuelType: data.match!.suggestedFuelType,
            tankCapacityVerified: false,
          }));
        }
      })
      .catch(() => {
        if (active) setSpecLookup("idle");
      });
    return () => {
      active = false;
    };
  }, [draft.make, draft.model, draft.year, tankManuallyEdited, manualVehicle]);

  function update<K extends keyof FuelProfile>(field: K, value: FuelProfile[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStepError(null);
  }

  // Switch into / out of typing a car that isn't in the autofill list.
  function enableManualVehicle() {
    setManualVehicle(true);
    setTankManuallyEdited(false);
    setSpecMatch(null);
    setSpecLookup("idle");
    setBodyStyle(null);
    setDraft((current) => ({ ...current, make: "", model: "" }));
    setStepError(null);
  }

  function useVehicleList() {
    setManualVehicle(false);
    setBodyStyle(null);
    setDraft((current) => ({ ...current, make: "", model: "" }));
    setStepError(null);
  }

  // Seed a sensible tank size / consumption for a body type the driver picks.
  function applyBodyStyle(id: string) {
    const preset = BODY_STYLE_DEFAULTS.find((style) => style.id === id);
    if (!preset) return;
    setBodyStyle(id);
    setTankManuallyEdited(false);
    setDraft((current) => ({
      ...current,
      tankCapacityLitres: preset.tankCapacityLitres,
      consumptionLPer100Km: preset.consumptionLPer100Km,
      fuelType: preset.suggestedFuelType,
      tankCapacityVerified: false,
    }));
  }

  function validateStep(index: number): string | null {
    if (index === 0) {
      if (manualVehicle) {
        if (!draft.make.trim()) return "Type your car's make so we can label your estimates.";
        if (draft.make.trim().length > 60) return "Keep the make under 60 characters.";
        if (!draft.model.trim()) return "Type your car's model so we can label your estimates.";
        if (draft.model.trim().length > 100) return "Keep the model under 100 characters.";
      } else {
        if (!draft.make.trim()) return "Choose your car's make, or add it manually.";
        if (!draft.model.trim()) return "Choose a model from the list.";
      }
      if (!Number.isInteger(draft.year) || draft.year < 1990 || draft.year > CURRENT_YEAR) {
        return `Model year must be between 1990 and ${CURRENT_YEAR}.`;
      }
      return null;
    }
    if (index === 1) {
      if (!Number.isFinite(draft.tankCapacityLitres) || draft.tankCapacityLitres < 10 || draft.tankCapacityLitres > 200) {
        return "Tank capacity must be between 10 and 200 litres.";
      }
      return null;
    }
    if (index === 2) {
      if (!Number.isFinite(draft.consumptionLPer100Km) || draft.consumptionLPer100Km < 2 || draft.consumptionLPer100Km > 40) {
        return "Consumption must be between 2 and 40 L/100 km.";
      }
      if (!Number.isFinite(draft.fuelPercent) || draft.fuelPercent < 0 || draft.fuelPercent > 100) {
        return "Fuel level must be between 0% and 100%.";
      }
      return null;
    }
    if (index === 3) {
      if (!draft.locationLabel.trim()) return "Tell us roughly where you fill up so we use the right price region.";
      if (draft.locationLabel.trim().length > 120) return "Keep the location under 120 characters.";
      return null;
    }
    return null;
  }

  function goToStep(next: number) {
    const problem = validateStep(step);
    if (problem) {
      setStepError(problem);
      return;
    }
    setStepError(null);
    setStep(Math.max(0, Math.min(STEP_LABELS.length - 1, next)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToStep(step + 1);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await authFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result)) {
        throw new Error(isRecord(result) && typeof result.error === "string" ? result.error : "Unable to save your car.");
      }
      const savedProfile = { ...DEFAULT_PROFILE, ...(result as FuelProfile) };
      if (onSaved) {
        onSaved(savedProfile);
      } else {
        // Full-page mode: nothing to update locally, so head to the dashboard.
        router.push("/");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save your car.");
    } finally {
      setSaving(false);
    }
  }

  const metrics = computeFuelMetrics(draft, prices?.pricePerLitre[draft.region]?.[draft.fuelType] ?? null);
  const tankIsEstimated = !draft.tankCapacityVerified;
  const specLabel = specMatch
    ? `${specMatch.make} ${specMatch.model} · ${specMatch.bodyStyle} · ${specMatch.yearFrom}–${specMatch.yearTo === CURRENT_YEAR ? "present" : specMatch.yearTo}`
    : null;

  const body = (
    <div className={`car-wizard${variant === "page" ? " car-wizard-page" : ""}`}>
      <header className="wizard-header">
        <div className="wizard-header-copy">
          {variant === "overlay" ? (
            <span className="wizard-icon"><ClipboardList size={19} /></span>
          ) : (
            <span className="wizard-icon"><ClipboardList size={19} /></span>
          )}
          <div>
            <p className="eyebrow">{profileSaved ? "EDIT YOUR CAR" : "QUICK SETUP · 5 STEPS"}</p>
            <h2>{profileSaved ? "Your car profile" : "Tell us about your car"}</h2>
          </div>
        </div>
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="Close questionnaire" disabled={saving}>
            <X size={18} />
          </button>
        )}
      </header>

      <div className="wizard-progress" aria-label={`Step ${step + 1} of ${STEP_LABELS.length}`}>
        <span className="wizard-progress-count">STEP {step + 1} / {STEP_LABELS.length}</span>
        <span className="wizard-progress-track" aria-hidden="true">
          <i style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }} />
        </span>
      </div>
      <ol className="wizard-step-list" aria-hidden="true">
        {STEP_LABELS.map((label, index) => (
          <li key={label} className={index === step ? "current" : index < step ? "done" : undefined}>
            <span className="wizard-step-bullet">{index < step ? <Check size={11} /> : index + 1}</span>
            <span className="wizard-step-name">{label}</span>
          </li>
        ))}
      </ol>

      <form className="wizard-form" onSubmit={handleSubmit} noValidate>
        {step === 0 && (
          <div className="wizard-step">
            <h3>Which car are we planning for?</h3>
            <p>We use this to suggest a tank size and fuel grade. Nothing is sent to a third party.</p>

            {manualVehicle ? (
              <>
                <div className="manual-vehicle-banner">
                  <span><PencilLine size={14} /> Entering your car manually</span>
                  <button type="button" onClick={useVehicleList}>Back to the car list</button>
                </div>
                <div className="form-grid two-col">
                  <label>
                    <span>Make</span>
                    <input
                      value={draft.make}
                      maxLength={60}
                      placeholder="e.g. Tata"
                      autoComplete="off"
                      onChange={(event) => update("make", event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    <span>Model</span>
                    <input
                      value={draft.model}
                      maxLength={100}
                      placeholder="e.g. Indica 1.4"
                      autoComplete="off"
                      onChange={(event) => update("model", event.currentTarget.value)}
                    />
                  </label>
                </div>
                <span className="field-label">Body type (sets a starting tank size you can adjust)</span>
                <div className="body-style-grid">
                  {BODY_STYLE_DEFAULTS.map((style) => (
                    <button
                      type="button"
                      key={style.id}
                      className={`body-style-card${bodyStyle === style.id ? " selected" : ""}`}
                      aria-pressed={bodyStyle === style.id}
                      onClick={() => applyBodyStyle(style.id)}
                    >
                      <strong>{style.label}</strong>
                      <small>{style.example}</small>
                      <span className="body-style-tank">{numberFormat(style.tankCapacityLitres)} L tank</span>
                      {bodyStyle === style.id && <span className="option-check"><Check size={12} /></span>}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="form-grid two-col">
                <label>
                  <span>Make</span>
                  <span className="select-wrap">
                    <select
                      value={draft.make}
                      onChange={(event) => {
                        const make = event.currentTarget.value;
                        if (make === OTHER_VEHICLE) {
                          enableManualVehicle();
                          return;
                        }
                        setTankManuallyEdited(false);
                        setDraft((current) => ({ ...current, make, model: "" }));
                      }}
                    >
                      <option value="">Select make…</option>
                      {(catalogue?.makes ?? []).map((make) => (
                        <option key={make} value={make}>{make}</option>
                      ))}
                      {catalogue && <option value={OTHER_VEHICLE}>{OTHER_VEHICLE}</option>}
                    </select>
                    <ChevronDown size={15} />
                  </span>
                </label>
                <label>
                  <span>Model</span>
                  <span className="select-wrap">
                    <select value={draft.model} onChange={(event) => update("model", event.currentTarget.value)} disabled={!draft.make}>
                      <option value="">{draft.make ? "Select model…" : "Choose a make first"}</option>
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </span>
                </label>
              </div>
            )}

            <label>
              <span>Model year</span>
              <span className="select-wrap">
                <select value={draft.year} onChange={(event) => update("year", Number(event.currentTarget.value))}>
                  {(catalogue?.years ?? Array.from({ length: CURRENT_YEAR - 1989 }, (_, index) => CURRENT_YEAR - index)).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </span>
            </label>

            {!manualVehicle && (
              <button type="button" className="manual-vehicle-link" onClick={enableManualVehicle}>
                <Search size={14} /> Can’t find your car? Enter it manually
              </button>
            )}

            <div className="wizard-status-line" role="status">
              {!manualVehicle && specLookup === "loading" && <><LoaderCircle size={14} className="spin" /> Looking up published tank size…</>}
              {!manualVehicle && specLookup === "idle" && specMatch && (
                <>
                  <BadgeCheck size={14} /> Spec match found: <strong>{specLabel}</strong>
                </>
              )}
              {!manualVehicle && specLookup === "miss" && (
                <>
                  <CircleAlert size={14} /> No spec entry for this model year. You can still continue and enter the tank size next.
                </>
              )}
              {manualVehicle && (
                <><Info size={14} /> Pick a body type above, then confirm the tank size on the next step.</>
              )}
              {!manualVehicle && specLookup === "idle" && !specMatch && !draft.model && (
                <><Search size={14} /> Pick a model to auto-fill the tank size.</>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="wizard-step">
            <h3>Fuel grade and tank size</h3>
            <p>Your tank size converts a fuel percentage into litres, so it matters most for range.</p>
            <span className="field-label">Fuel type</span>
            <div className="option-grid">
              {FUEL_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`option-card${draft.fuelType === option.value ? " selected" : ""}`}
                  aria-pressed={draft.fuelType === option.value}
                  onClick={() => update("fuelType", option.value as FuelType)}
                >
                  <span className="option-card-top"><Fuel size={15} /><strong>{option.label}</strong></span>
                  <small>{option.hint}</small>
                  {draft.fuelType === option.value && <span className="option-check"><Check size={12} /></span>}
                </button>
              ))}
            </div>
            <label>
              <span>Tank capacity (litres)</span>
              <span className="input-suffix">
                <input
                  type="number"
                  min={10}
                  max={200}
                  step={0.5}
                  value={draft.tankCapacityLitres}
                  onChange={(event) => {
                    setTankManuallyEdited(true);
                    update("tankCapacityLitres", Number(event.currentTarget.value));
                  }}
                />
                <em>L</em>
              </span>
            </label>
            <div className="verification-row">
              <span className="wizard-source-badge">
                {specMatch ? <BadgeCheck size={14} /> : <Info size={14} />}
                {tankIsEstimated
                  ? specMatch
                    ? `Estimated from specs · ${numberFormat(draft.tankCapacityLitres)} L typical`
                    : "Estimated · entered by you"
                  : "Verified · you confirmed this figure"}
              </span>
              <label className="verified-check inline">
                <input
                  type="checkbox"
                  checked={draft.tankCapacityVerified}
                  onChange={(event) => update("tankCapacityVerified", event.currentTarget.checked)}
                />
                <span className="custom-check"><Check size={12} /></span>
                <span>
                  <strong>I verified this tank size</strong>
                  <small>From the owner’s manual, filler flap or a trusted spec sheet.</small>
                </span>
              </label>
            </div>
            <p className="wizard-note"><Info size={13} /> Tank size is never treated as verified unless you tick the box. That keeps your range estimate honest.</p>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <h3>How does this car drink?</h3>
            <p>We suggested a figure from published specs. Nudge it to match your real driving.</p>
            <span className="field-label">Typical driving</span>
            <div className="option-grid three">
              {DRIVING_STYLES.map((style) => (
                <button
                  type="button"
                  key={style.id}
                  className={`option-card${(specMatch?.consumptionLPer100Km ?? draft.consumptionLPer100Km) * style.factor === draft.consumptionLPer100Km ? " selected" : ""}`}
                  aria-pressed={Math.round((specMatch?.consumptionLPer100Km ?? draft.consumptionLPer100Km) * style.factor * 10) / 10 === draft.consumptionLPer100Km}
                  onClick={() => {
                    const base = specMatch?.consumptionLPer100Km ?? draft.consumptionLPer100Km;
                    update("consumptionLPer100Km", Math.round(base * style.factor * 10) / 10);
                  }}
                >
                  <span className="option-card-top"><Gauge size={15} /><strong>{style.label}</strong></span>
                  <small>{style.description}</small>
                </button>
              ))}
            </div>
            <label>
              <span>Average consumption (L / 100 km)</span>
              <span className="input-suffix">
                <input
                  type="number"
                  min={2}
                  max={40}
                  step={0.1}
                  value={draft.consumptionLPer100Km}
                  onChange={(event) => update("consumptionLPer100Km", Number(event.currentTarget.value))}
                />
                <em>L / 100 km</em>
              </span>
            </label>
            <label className="slider-field">
              <span>Fuel in the tank right now <b>{numberFormat(draft.fuelPercent)}%</b></span>
              <input
                className="fuel-range-slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.min(100, Math.max(0, draft.fuelPercent))}
                aria-label="Fuel level percentage"
                style={{ background: `linear-gradient(90deg, #81a840 ${draft.fuelPercent}%, #e7ebe4 ${draft.fuelPercent}%)` }}
                onChange={(event) => update("fuelPercent", Number(event.currentTarget.value))}
              />
              <span className="slider-labels"><span>Empty</span><span>Full</span></span>
            </label>
            <p className="wizard-note"><Info size={13} /> Live OBD-II reading isn’t connected in this MVP, so today’s level is manual. Enter what your dash gauge shows.</p>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <h3>Where do you usually fill up?</h3>
            <p>South Africa has inland and coastal price zones, so this keeps the rand estimate realistic.</p>
            <span className="field-label">Price region</span>
            <div className="option-grid two">
              {([
                { id: "inland", title: "Inland", hint: "Gauteng, Free State, Limpopo, Mpumalanga, North West, KZN interior" },
                { id: "coastal", title: "Coastal", hint: "Cape Town, Durban, Gqeberha, East London and coastal towns" },
              ] as { id: PricingRegion; title: string; hint: string }[]).map((region) => (
                <button
                  type="button"
                  key={region.id}
                  className={`option-card${draft.region === region.id ? " selected" : ""}`}
                  aria-pressed={draft.region === region.id}
                  onClick={() => update("region", region.id)}
                >
                  <span className="option-card-top"><MapPin size={15} /><strong>{region.title}</strong></span>
                  <small>{region.hint}</small>
                  {draft.region === region.id && <span className="option-check"><Check size={12} /></span>}
                </button>
              ))}
            </div>
            <label>
              <span>Home area label</span>
              <input
                value={draft.locationLabel}
                maxLength={120}
                placeholder="e.g. Centurion, Gauteng"
                onChange={(event) => update("locationLabel", event.currentTarget.value)}
              />
            </label>
            <div className="price-preview">
              <Wallet size={15} />
              <span>
                Reference price for {getFuelOption(draft.fuelType).shortLabel} in your region:{" "}
                <strong>
                  {typeof prices?.pricePerLitre[draft.region]?.[draft.fuelType] === "number"
                    ? `${moneyFormat(prices!.pricePerLitre[draft.region][draft.fuelType]!, 2)} / L`
                    : "not published — you can enter a pump price on the dashboard"}
                </strong>
              </span>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-step wizard-summary">
            <h3>Here’s your setup</h3>
            <p>Save this and we’ll show your range, refill cost and safe-stop point on the dashboard.</p>
            <dl className="summary-grid">
              <div><dt>Vehicle</dt><dd>{draft.year} {draft.make} {draft.model}</dd></div>
              <div><dt>Fuel</dt><dd>{getFuelOption(draft.fuelType).label}</dd></div>
              <div>
                <dt>Tank</dt>
                <dd>
                  {numberFormat(draft.tankCapacityLitres, draft.tankCapacityVerified ? 0 : 1)} L{" "}
                  <span className={draft.tankCapacityVerified ? "tag verified" : "tag estimated"}>
                    {draft.tankCapacityVerified ? "verified" : "estimated"}
                  </span>
                </dd>
              </div>
              <div><dt>Consumption</dt><dd>{numberFormat(draft.consumptionLPer100Km, 1)} L / 100 km</dd></div>
              <div><dt>Fuel now</dt><dd>{numberFormat(metrics.fuelLitres, 1)} L · {numberFormat(draft.fuelPercent)}%</dd></div>
              <div><dt>Likely range</dt><dd>{numberFormat(metrics.rangeLow)}–{numberFormat(metrics.rangeHigh)} km</dd></div>
              <div><dt>Refill to full</dt><dd>{metrics.refillCost === null ? "price unavailable" : moneyFormat(metrics.refillCost)}</dd></div>
              <div><dt>Region</dt><dd>{draft.region === "inland" ? "Inland" : "Coastal"} · {draft.locationLabel}</dd></div>
            </dl>
            <div className="wizard-trust">
              <ShieldCheck size={15} />
              <span>All figures are estimates for planning only — not navigation, and not a promise of remaining range.</span>
            </div>
          </div>
        )}

        {(stepError || saveError) && (
          <p className="form-error" role="alert"><CircleAlert size={14} /> {saveError ?? stepError}</p>
        )}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="button-secondary" onClick={() => { setStepError(null); setStep(step - 1); }} disabled={saving}>
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <span className="wizard-actions-hint"><CircleHelp size={14} /> Takes about a minute</span>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <button type="submit" className="button-primary">
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button type="button" className="button-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
              {saving ? "Saving…" : profileSaved ? "Update my car" : "Save my car"}
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (variant === "page") {
    return <div className="questionnaire-page">{body}</div>;
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <section className="vehicle-modal questionnaire-modal" role="dialog" aria-modal="true" aria-labelledby="questionnaire-title">
        <span id="questionnaire-title" className="sr-only">Your car questionnaire</span>
        {body}
      </section>
    </div>
  );
}

export function QuestionnaireCallout({ onOpen, heading, copy }: { onOpen: () => void; heading: string; copy: string }) {
  return (
    <div className="callout-card">
      <span className="callout-icon"><CarFront size={18} /></span>
      <div className="callout-copy">
        <strong>{heading}</strong>
        <span>{copy}</span>
      </div>
      <button className="callout-button" onClick={onOpen}>
        Answer the questions <ArrowRight size={14} />
      </button>
    </div>
  );
}


