"use client";
import { useEffect, useState } from "react";
import type { TraceEvent } from "@/lib/impact/engine";
export function TracePlayer({
  events,
  onFocus,
}: {
  events: TraceEvent[];
  onFocus: (path: string, token?: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(600);
  const event = events[step];
  useEffect(() => {
    if (!playing || step >= events.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [playing, step, delay, events.length]);
  useEffect(() => {
    if (event?.path) onFocus(event.path, event.token);
  }, [event, onFocus]);
  return (
    <section className="trace-player" aria-label="Virtual interpreter timeline">
      <div className="lab-panel-title">
        <h2>Follow the interpreter</h2>
        <span>
          {step + 1} / {events.length} real events
        </span>
      </div>
      <div className="playback-controls">
        <button
          onClick={() => setPlaying((v) => !v)}
          disabled={step >= events.length - 1}
        >
          {playing && step < events.length - 1 ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={!step}
        >
          Step back
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.min(events.length - 1, s + 1));
          }}
          disabled={step >= events.length - 1}
        >
          Step forward
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
        >
          Reset trace
        </button>
        <label>
          Playback speed
          <select
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          >
            <option value={1200}>0.5×</option>
            <option value={600}>1×</option>
            <option value={200}>3×</option>
          </select>
        </label>
      </div>
      <input
        type="range"
        aria-label="Interpreter event"
        min={0}
        max={Math.max(0, events.length - 1)}
        value={step}
        onChange={(e) => {
          setPlaying(false);
          setStep(Number(e.target.value));
        }}
      />
      <div className="trace-event" aria-live={playing ? "off" : "polite"}>
        <strong>{event?.stage}</strong>
        <code>{event?.path}</code>
        <p>{event?.detail}</p>
      </div>
      <p className="lab-fixture-note">
        Playback selects the real event’s path and predicate. Stepping back
        replays recorded observations; only Apply changes the virtual snapshot.
      </p>
    </section>
  );
}
