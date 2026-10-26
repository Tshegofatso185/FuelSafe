"use client";

import { moneyFormat, numberFormat, type FuelMetrics, type FuelProfile } from "@/lib/fuel";
import type { FuelAdvice } from "@/lib/recommendations";

export type SpeechSupport =
  | { ok: true }
  | { ok: false; message: string };

export function checkSpeechSupport(): SpeechSupport {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { ok: false, message: "This browser can't speak out loud. Try Chrome, Edge or Safari." };
  }
  return { ok: true };
}

export type SpokenVoice = {
  id: string;
  name: string;
  label: string;
  lang: string;
  localService: boolean;
  isSouthAfrican: boolean;
  isEnglish: boolean;
};

const STORAGE_KEY = "fuelsafe_voice";
const AUTO_KEY = "fuelsafe_voice_auto";

/** Browser voices arrive asynchronously; resolve once they're ready. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    // Fallback in case the event never fires.
    window.setTimeout(done, 1200);
  });
}

function friendlyName(voice: SpeechSynthesisVoice): string {
  // Trim vendor noise like "Microsoft Aria Online (Natural) - English (US)".
  let name = voice.name.replace(/\s*\((?:Natural|Enhanced|Premium|Online|Compact)\)/gi, "");
  name = name.replace(/^(Microsoft|Google|Apple)\s+/i, "");
  name = name.replace(/\s*-\s*English.*$/i, "");
  name = name.replace(/\s*Online$/i, "");
  return name.trim() || voice.name;
}

export function describeVoices(raw: SpeechSynthesisVoice[]): SpokenVoice[] {
  const english = raw.filter((voice) => /^en(-|_|$)/i.test(voice.lang));
  const pool = english.length > 0 ? english : raw;
  const mapped = pool.map((voice) => {
    const isSouthAfrican = /za/i.test(voice.lang);
    return {
      id: voice.voiceURI,
      name: voice.name,
      label: friendlyName(voice),
      lang: voice.lang,
      localService: voice.localService,
      isSouthAfrican,
      isEnglish: /^en(-|_|$)/i.test(voice.lang),
    };
  });
  // South African English first, then other English, nicer names sorted up.
  return mapped.sort((a, b) => {
    if (a.isSouthAfrican !== b.isSouthAfrican) return a.isSouthAfrican ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function pickDefaultVoice(voices: SpokenVoice[]): string | null {
  if (voices.length === 0) return null;
  const saved = loadSavedVoiceId();
  if (saved && voices.some((voice) => voice.id === saved)) return saved;
  // Preferred default: Google UK English Male.
  const googleUkMale = voices.find((voice) => /google uk english male/i.test(voice.name));
  if (googleUkMale) return googleUkMale.id;
  const ukMale = voices.find((voice) => /gb/i.test(voice.lang) && /male/i.test(voice.name));
  if (ukMale) return ukMale.id;
  const uk = voices.find((voice) => /gb/i.test(voice.lang));
  if (uk) return uk.id;
  const za = voices.find((voice) => voice.isSouthAfrican);
  return (za ?? voices[0]).id;
}

export function loadSavedVoiceId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveVoiceId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignore storage failures.
  }
}

export function loadAutoAnnounce(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAutoAnnounce(on: boolean): void {
  try {
    window.localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

export type SpeakOptions = { voiceId?: string | null; rate?: number; pitch?: number };

/** Speaks text aloud, cancelling anything already playing. */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  if (options.voiceId) {
    const match = synth.getVoices().find((voice) => voice.voiceURI === options.voiceId);
    if (match) {
      utterance.voice = match;
      utterance.lang = match.lang;
    }
  }
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

/** A short preview line so the driver can hear the chosen voice. */
export function sampleLine(profile: FuelProfile): string {
  void profile;
  return "FuelSafe co-pilot. I'll read your fuel and range out loud, so you keep your eyes on the road.";
}

/** A brief one-time welcome, then straight into the numbers. */
export function buildWelcomeBriefing(name: string, profile: FuelProfile): string {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  void profile;
  return `Hi ${first}. Here's your fuel.`;
}

/**
 * Builds a short, straight-to-the-point briefing. A driver worried about petrol
 * wants the numbers fast, so we lead with litres, range and the one thing to do.
 * No long intros or jokes.
 */
export function buildSpokenBriefing(
  profile: FuelProfile,
  metrics: FuelMetrics,
  advice: FuelAdvice,
): string {
  const parts: string[] = [];
  const litres = numberFormat(metrics.fuelLitres, 0);
  const percent = numberFormat(Math.min(100, Math.max(0, profile.fuelPercent)), 0);
  const low = numberFormat(metrics.rangeLow, 0);
  const high = numberFormat(metrics.rangeHigh, 0);
  const safeStop = numberFormat(metrics.safeStopKm, 0);

  if (advice.recommendations.some((item) => item.id === "demo-reading")) {
    return `Demo mode: about ${litres} litres, ${percent} percent, roughly ${low} to ${high} kilometres. Enter your gauge reading for your own car.`;
  }

  // 1. The numbers, straight away.
  parts.push(`${litres} litres, ${percent} percent. About ${low} to ${high} kilometres.`);

  // 2. The one action that matters.
  if (advice.level === "critical") {
    parts.push("Refuel now — you're very low.");
  } else if (advice.level === "low") {
    parts.push(`Fill up within about ${safeStop} kilometres.`);
  } else {
    parts.push(`Good for trips up to about ${safeStop} kilometres.`);
  }

  // 3. Cost to fill, when we have it.
  if (metrics.refillCost !== null) {
    parts.push(`A full tank is about ${moneyFormat(metrics.refillCost, 0)}.`);
  }

  // 4. Only the most important single warning, if any.
  if (advice.recommendations.some((item) => item.id === "no-reading")) {
    parts.push("Note: this is your setup level, not a fresh reading.");
  } else if (advice.recommendations.some((item) => item.id === "diesel-dry")) {
    parts.push("Don't let the diesel run dry.");
  }

  return parts.join(" ");
}
