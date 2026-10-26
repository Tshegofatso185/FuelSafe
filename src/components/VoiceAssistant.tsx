"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FuelMetrics, FuelProfile } from "@/lib/fuel";
import type { FuelAdvice } from "@/lib/recommendations";
import {
  buildSpokenBriefing,
  buildWelcomeBriefing,
  checkSpeechSupport,
  describeVoices,
  loadAutoAnnounce,
  loadVoices,
  pickDefaultVoice,
  saveAutoAnnounce,
  speak,
  stopSpeaking,
} from "@/lib/speech";

export default function VoiceAssistant({
  profile,
  metrics,
  advice,
  userName,
}: {
  profile: FuelProfile;
  metrics: FuelMetrics;
  advice: FuelAdvice;
  userName: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [autoAnnounce, setAutoAnnounce] = useState(false);
  const lastBriefing = useRef<string>("");
  const hasWelcomed = useRef(false);

  useEffect(() => {
    const support = checkSpeechSupport();
    if (!support.ok) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setAutoAnnounce(loadAutoAnnounce());
    let active = true;
    void loadVoices().then((raw) => {
      if (!active) return;
      setVoiceId(pickDefaultVoice(describeVoices(raw)));
    });

    // Keep the speaking indicator in sync with the engine.
    const synth = window.speechSynthesis;
    const poll = window.setInterval(() => {
      setSpeaking(synth.speaking && !synth.paused);
    }, 300);
    return () => {
      active = false;
      window.clearInterval(poll);
      stopSpeaking();
    };
  }, []);

  const briefing = useMemo(
    () => buildSpokenBriefing(profile, metrics, advice),
    [profile, metrics, advice],
  );

  // When auto-announce is on, speak once whenever the briefing meaningfully changes.
  useEffect(() => {
    if (!autoAnnounce || supported !== true || !voiceId) return;
    if (lastBriefing.current === briefing) return;
    lastBriefing.current = briefing;
    speak(briefing, { voiceId });
    setSpeaking(true);
  }, [autoAnnounce, briefing, voiceId, supported]);

  // Greet the driver automatically on arrival. Browsers block speech until the
  // user interacts, so if the first attempt is silent we retry on the first
  // tap, key press or scroll — then it plays by itself.
  useEffect(() => {
    if (supported !== true || !voiceId || hasWelcomed.current) return;

    const playWelcome = () => {
      if (hasWelcomed.current) return;
      const text = `${buildWelcomeBriefing(userName, profile)} ${briefing}`;
      lastBriefing.current = briefing;
      speak(text, { voiceId });
      // Did it actually start? If blocked, arm it for the next interaction.
      window.setTimeout(() => {
        if (window.speechSynthesis.speaking) {
          hasWelcomed.current = true;
          setSpeaking(true);
          removeListeners();
        }
      }, 350);
    };

    const onGesture = () => playWelcome();
    const removeListeners = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("scroll", onGesture);
    };

    playWelcome();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture);
    window.addEventListener("scroll", onGesture, { passive: true });
    return removeListeners;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, voiceId]);

  function handleReadAloud() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    // The first time, greet the driver and explain the app, then the status.
    const intro = hasWelcomed.current ? "" : `${buildWelcomeBriefing(userName, profile)} `;
    hasWelcomed.current = true;
    lastBriefing.current = briefing;
    speak(`${intro}${briefing}`, { voiceId });
    setSpeaking(true);
  }

  function toggleAuto() {
    const next = !autoAnnounce;
    setAutoAnnounce(next);
    saveAutoAnnounce(next);
    if (next) {
      lastBriefing.current = briefing;
      speak(briefing, { voiceId });
      setSpeaking(true);
    } else {
      stopSpeaking();
      setSpeaking(false);
    }
  }

  if (supported === false) {
    return (
      <section className="panel voice-card voice-card-off">
        <div className="voice-head">
          <span className="voice-badge"><VolumeX size={16} /></span>
          <div>
            <h3>Voice co-pilot</h3>
            <p>This browser can&apos;t read aloud. Try Chrome, Edge or Safari to hear your fuel updates hands-free.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel voice-card" aria-labelledby="voice-title">
      <div className="voice-head">
        <span className={`voice-badge${speaking ? " is-speaking" : ""}`}>
          <Volume2 size={20} />
          {speaking && <span className="voice-wave" aria-hidden="true"><i /><i /><i /><i /></span>}
        </span>
        <div className="voice-head-copy">
          <div className="voice-title-row">
            <h3 id="voice-title">Voice co-pilot</h3>
          </div>
        </div>
      </div>

      <div className="voice-actions">
        <button className={`voice-main${speaking ? " is-stop" : ""}`} onClick={handleReadAloud} disabled={supported === null}>
          <span className="voice-main-icon">
            {speaking ? <Pause size={18} /> : <Play size={18} />}
          </span>
          <span className="voice-main-text">
            <strong>{speaking ? "Pause co-pilot" : hasWelcomed.current ? "Read fuel status aloud" : "Play voice guide"}</strong>
          </span>
        </button>
        <button
          className={`voice-auto${autoAnnounce ? " is-on" : ""}`}
          onClick={toggleAuto}
          role="switch"
          aria-checked={autoAnnounce}
        >
          <span className="voice-auto-track"><span className="voice-auto-knob" /></span>
          <span className="voice-auto-label">
            <strong>Auto-announce updates</strong>
          </span>
        </button>
      </div>

    </section>
  );
}
