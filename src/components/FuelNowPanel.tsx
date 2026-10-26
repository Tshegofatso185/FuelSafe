"use client";

import {
  Bluetooth,
  BluetoothSearching,
  Check,
  CircleAlert,
  FlaskConical,
  Info,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/client-auth";
import { computeFuelMetrics, numberFormat, type FuelMetrics, type FuelProfile } from "@/lib/fuel";
import {
  checkBluetoothSupport,
  connectBluetoothAdapter,
  createDemoTransport,
  isInsideFrame,
  ObdError,
  readFuelLevel,
  reconnectKnownAdapter,
  type ObdStep,
  type ObdTransport,
} from "@/lib/obd";
import { buildFuelAdvice } from "@/lib/recommendations";
import VoiceAssistant from "@/components/VoiceAssistant";

export type FuelReading = {
  id: string;
  fuelPercent: number;
  litres: number;
  source: "obd" | "manual" | "demo";
  adapterName: string | null;
  createdAt: string;
};

type Phase = "idle" | "connecting" | "reading" | "saving" | "done" | "error";

const SOURCE_LABEL: Record<FuelReading["source"], string> = {
  obd: "Live from your car",
  manual: "Entered from your gauge",
  demo: "Demo — not your car",
};

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default function FuelNowPanel({
  profile,
  metrics,
  onFuelUpdated,
  userName,
}: {
  profile: FuelProfile;
  metrics: FuelMetrics;
  onFuelUpdated: (fuelPercent: number) => void;
  userName: string;
}) {
  const [latest, setLatest] = useState<FuelReading | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<ObdStep[]>([]);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState(Math.round(profile.fuelPercent));
  const [demoPercent, setDemoPercent] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [support, setSupport] = useState<ReturnType<typeof checkBluetoothSupport> | null>(null);
  const [inFrame, setInFrame] = useState(false);
  const transportRef = useRef<ObdTransport | null>(null);

  useEffect(() => {
    setSupport(checkBluetoothSupport());
    setInFrame(isInsideFrame());
    let active = true;
    authFetch("/api/fuel-readings")
      .then(async (response) => (response.ok ? ((await response.json()) as { readings: FuelReading[] }) : null))
      .then((data) => {
        if (active && data?.readings[0]) setLatest(data.readings[0]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingLatest(false);
      });

    // Auto-reconnect: if the driver has allowed an adapter before, connect and
    // read straight away with no tap. (First-ever connection still needs a tap.)
    void (async () => {
      try {
        const transport = await reconnectKnownAdapter();
        if (!active || !transport) {
          transport?.close();
          return;
        }
        transportRef.current = transport;
        setPhase("reading");
        const percent = await readFuelLevel(transport, setSteps);
        await saveReading(percent, "obd", transport.name);
        if (active) setPhase("done");
      } catch {
        // Silent: the driver can still tap Connect. No error shown for auto-try.
        if (active) setPhase("idle");
      }
    })();

    return () => {
      active = false;
      transportRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayProfile = useMemo(
    () => demoPercent === null ? profile : { ...profile, fuelPercent: Math.round(demoPercent * 10) / 10 },
    [profile, demoPercent],
  );
  const displayMetrics = useMemo(
    () => demoPercent === null ? metrics : computeFuelMetrics(displayProfile, metrics.pricePerLitre),
    [demoPercent, displayProfile, metrics],
  );
  const advice = useMemo(
    () => buildFuelAdvice(displayProfile, displayMetrics, {
      source: demoPercent !== null ? "demo" : latest?.source ?? null,
      takenAt: demoPercent !== null ? null : latest?.createdAt ?? null,
    }),
    [displayProfile, displayMetrics, demoPercent, latest],
  );
  const demoReading = demoPercent !== null || latest?.source === "demo";
  const readingReminder = advice.recommendations.find(
    (item) => item.id === "no-reading" || item.id === "stale" || item.id === "demo-reading",
  );

  async function saveReading(fuelPercent: number, source: "obd" | "manual", adapterName: string | null) {
    setPhase("saving");
    const response = await authFetch("/api/fuel-readings", {
      method: "POST",
      body: JSON.stringify({ fuelPercent, source, adapterName }),
    });
    const result = (await response.json()) as { reading?: FuelReading; error?: string };
    if (!response.ok || !result.reading) throw new Error(result.error ?? "Couldn't save the reading.");
    setLatest(result.reading);
    onFuelUpdated(result.reading.fuelPercent);
    setManualValue(Math.round(result.reading.fuelPercent));
  }

  async function runReading(mode: "bluetooth" | "demo") {
    setError(null);
    setSteps([]);
    setManualOpen(false);
    setPhase("connecting");
    let transport = transportRef.current;
    try {
      if (mode === "demo") {
        transport?.close();
        transport = createDemoTransport(profile.fuelPercent);
      } else if (!transport || transport.name.startsWith("Demo")) {
        transport?.close();
        transport = await connectBluetoothAdapter(showAll);
      }
      transportRef.current = transport;
      setPhase("reading");
      const percent = await readFuelLevel(transport, setSteps);
      if (mode === "demo") {
        setDemoPercent(percent);
      } else {
        await saveReading(percent, "obd", transport.name);
        setDemoPercent(null);
      }
      setPhase("done");
    } catch (caught) {
      if (caught instanceof ObdError) {
        if (caught.code === "cancelled") {
          setPhase("idle");
          return;
        }
        if (caught.code === "disconnected" || caught.code === "timeout") {
          transportRef.current?.close();
          transportRef.current = null;
        }
        setError({ message: caught.message, code: caught.code });
        if (caught.code === "not_supported" || caught.code === "no_data") setManualOpen(true);
      } else {
        setError({ message: caught instanceof Error ? caught.message : "Something went wrong reading your fuel." });
      }
      setPhase("error");
    }
  }

  async function submitManual() {
    setError(null);
    try {
      await saveReading(manualValue, "manual", null);
      setDemoPercent(null);
      setManualOpen(false);
      setPhase("done");
    } catch (caught) {
      setError({ message: caught instanceof Error ? caught.message : "Couldn't save the reading." });
      setPhase("error");
    }
  }

  const busy = phase === "connecting" || phase === "reading" || phase === "saving";
  const connected = Boolean(transportRef.current && !transportRef.current.name.startsWith("Demo"));
  const percent = Math.min(100, Math.max(0, displayProfile.fuelPercent));
  const bluetoothBlocked = inFrame || (support !== null && !support.ok);

  return (
    <>
    <VoiceAssistant profile={displayProfile} metrics={displayMetrics} advice={advice} userName={userName} />
    <section className="fuel-now" aria-labelledby="fuel-now-title">
      <article className={`panel fuel-now-card level-${advice.level}`}>
        <div className="fuel-now-head">
          <div>
            <p className="eyebrow">{demoReading ? "DEMO READING" : "YOUR FUEL RIGHT NOW"}</p>
            <h2 id="fuel-now-title">{demoReading ? "Try a real fuel reading" : advice.headline}</h2>
          </div>
          {(demoReading || latest) && (
            <span className={`fuel-source-badge source-${demoReading ? "demo" : latest?.source ?? "setup"}`}>
              {demoReading ? <FlaskConical size={12} /> : latest?.source === "obd" ? <Bluetooth size={12} /> : <PencilLine size={12} />}
              {demoReading ? "Demo — not your car" : latest ? SOURCE_LABEL[latest.source] : ""}
            </span>
          )}
        </div>

        <div className="fuel-now-main">
          <div className="fuel-now-reading">
            <div className="fuel-now-tank" aria-hidden="true">
            <span style={{ height: `${percent}%` }} />
            <i style={{ bottom: "15%" }} />
          </div>
          <div className="fuel-now-figures">
            <div className="fuel-now-big">
              <strong>{numberFormat(displayMetrics.fuelLitres, 1)}</strong>
              <span>litres</span>
            </div>
            <p className="fuel-now-sub">
              {numberFormat(percent)}% of {numberFormat(profile.tankCapacityLitres)} L
              {profile.tankCapacityVerified ? "" : " (estimated tank)"} · about{" "}
              <b>{numberFormat(displayMetrics.rangeLow)}–{numberFormat(displayMetrics.rangeHigh)} km</b>
            </p>
            <p className="fuel-now-summary">
              {demoReading ? "This is a simulation. Use your gauge or a compatible adapter for your own fuel level." : advice.summary}
            </p>
            {readingReminder && !loadingLatest && !demoReading && (
              <p className="fuel-now-freshness" role="status">
                <CircleAlert size={14} aria-hidden="true" />
                {readingReminder.id === "no-reading"
                  ? "From setup, not a live reading. Update from your gauge or car."
                  : "This reading may be old. Refresh it after driving."}
              </p>
            )}
            {demoPercent !== null ? (
              <p className="fuel-now-meta">Preview only · not saved to your car</p>
            ) : latest && (
              <p className="fuel-now-meta">
                Read {timeAgo(latest.createdAt)}
                {latest.adapterName && latest.source !== "manual" ? ` · ${latest.adapterName}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="fuel-now-controls">
          <div className="fuel-now-controls-heading">
            <strong>Update your fuel level</strong>
            <span>How would you like to get a reading?</span>
          </div>
          <div className="fuel-now-actions">
            {bluetoothBlocked ? (
              <button className="button-primary" onClick={() => { setManualOpen(true); setError(null); }} disabled={busy}>
                <PencilLine size={16} /> Enter from my gauge
              </button>
            ) : (
              <button className="button-primary" onClick={() => void runReading("bluetooth")} disabled={busy}>
                {busy && phase !== "saving" ? <LoaderCircle size={16} className="spin" /> : connected ? <RefreshCw size={16} /> : <BluetoothSearching size={16} />}
                {connected ? "Read fuel again" : "Connect via Bluetooth"}
              </button>
            )}
            {!bluetoothBlocked && (
              <button className="button-secondary" onClick={() => { setManualOpen((open) => !open); setError(null); }} disabled={busy}>
                <PencilLine size={15} /> Enter from gauge
              </button>
            )}
            <button className="button-ghost" onClick={() => void runReading("demo")} disabled={busy}>
              <FlaskConical size={15} /> Try demo
            </button>
          </div>
          {demoPercent !== null && (
            <button className="fuel-now-exit-demo" type="button" onClick={() => {
              setDemoPercent(null);
              setSteps([]);
              setError(null);
              setPhase("idle");
              transportRef.current?.close();
              transportRef.current = null;
            }}>Back to my saved fuel</button>
          )}
          {inFrame && (
            <p className="fuel-now-hint">Bluetooth is unavailable in this preview. Use your gauge for a real reading.</p>
          )}
          {!inFrame && support && !support.ok && (
            <p className="fuel-now-hint">{support.message}</p>
          )}
          {!inFrame && !connected && !bluetoothBlocked && (
            <label className="show-all-toggle">
              <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.currentTarget.checked)} disabled={busy} />
              Adapter not showing? Show all devices
            </label>
          )}
        </div>
        </div>

        {steps.length > 0 && (
          <ol className="obd-steps" aria-live="polite">
            {steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className={`step-${step.state}`}>
                {step.state === "running" ? <LoaderCircle size={13} className="spin" /> : step.state === "done" ? <Check size={13} /> : step.state === "warn" ? <CircleAlert size={13} /> : <X size={13} />}
                {step.label}
              </li>
            ))}
            {phase === "saving" && <li className="step-running"><LoaderCircle size={13} className="spin" /> Saving your reading</li>}
          </ol>
        )}

        {error && (
          <div className="obd-note obd-note-error" role="alert">
            <CircleAlert size={15} />
            <div>{error.message}</div>
          </div>
        )}

        {manualOpen && (
          <div className="manual-reading">
            <label htmlFor="manual-fuel">
              Fuel gauge: <b>{manualValue}%</b> · {numberFormat((profile.tankCapacityLitres * manualValue) / 100, 1)} L
            </label>
            <input
              id="manual-fuel"
              className="fuel-range-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={manualValue}
              style={{ background: `linear-gradient(90deg, #81a840 ${manualValue}%, #e7ebe4 ${manualValue}%)` }}
              onChange={(event) => setManualValue(Number(event.currentTarget.value))}
            />
            <div className="gauge-presets">
              {[{ label: "E", value: 5 }, { label: "¼", value: 25 }, { label: "½", value: 50 }, { label: "¾", value: 75 }, { label: "F", value: 100 }].map((preset) => (
                <button key={preset.label} type="button" className={manualValue === preset.value ? "active" : undefined} onClick={() => setManualValue(preset.value)}>
                  {preset.label}
                </button>
              ))}
            </div>
            <button className="button-primary" onClick={() => void submitManual()} disabled={busy}>
              {phase === "saving" ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Save reading
            </button>
          </div>
        )}

        <details className="obd-help">
          <summary><Info size={13} /> Need an adapter?</summary>
          <p>Use a Bluetooth LE OBD-II adapter (e.g. Vgate iCar Pro BLE, Veepeak OBDCheck BLE). Plug it in, ignition on, then connect in Chrome or Edge.</p>
        </details>
      </article>


    </section>
    </>
  );
}
