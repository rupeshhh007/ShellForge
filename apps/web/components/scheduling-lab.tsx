"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  schedule,
  POLICIES,
  type Policy,
  type Process,
} from "@/lib/impact/scheduler";
const initial: Process[] = [
  { id: "A", arrival: 0, burst: 5, priority: 2 },
  { id: "B", arrival: 1, burst: 2, priority: 1 },
  { id: "C", arrival: 2, burst: 1, priority: 0 },
];
export function SchedulingLab() {
  const [jobs, setJobs] = useState(initial),
    [policy, setPolicy] = useState<Policy>("SRTF"),
    [quantum, setQuantum] = useState(2),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  const result = useMemo(() => {
    try {
      return { value: schedule(jobs, policy, quantum), error: "" };
    } catch (e) {
      return { value: null, error: String(e instanceof Error ? e.message : e) };
    }
  }, [jobs, policy, quantum]);
  const value = result.value,
    frame = value?.frames[Math.min(step, value.duration)];
  useEffect(() => {
    if (!playing || !value || step >= value.duration) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [playing, step, value]);
  function reset() {
    setStep(0);
    setPlaying(false);
  }
  return (
    <section className="scheduling-lab" aria-label="CPU scheduling laboratory">
      <p>
        One CPU, integer time, zero dispatch cost, CPU-only bursts. SJF and
        Priority are non-preemptive. Lower priority numbers win. Ties: earlier
        arrival, then input row order. RR enqueues boundary arrivals before the
        expired process.
      </p>
      <div className="playback-controls">
        <label>
          Scheduling policy
          <select
            value={policy}
            onChange={(e) => {
              setPolicy(e.target.value as Policy);
              reset();
            }}
          >
            {POLICIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          RR quantum
          <input
            type="number"
            min={1}
            max={100}
            value={quantum}
            onChange={(e) => {
              setQuantum(Number(e.target.value));
              reset();
            }}
          />
        </label>
        <button
          onClick={() => {
            setJobs(initial);
            reset();
          }}
        >
          Reset processes
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Arrival</th>
              <th>Burst</th>
              <th>Priority</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => (
              <tr key={i}>
                {(["id", "arrival", "burst", "priority"] as const).map(
                  (field) => (
                    <td key={field}>
                      <input
                        aria-label={`Process ${i + 1} ${field}`}
                        type={field === "id" ? "text" : "number"}
                        value={job[field]}
                        onChange={(e) => {
                          setJobs((rows) =>
                            rows.map((p, j) =>
                              i === j
                                ? {
                                    ...p,
                                    [field]:
                                      field === "id"
                                        ? e.target.value
                                        : Number(e.target.value),
                                  }
                                : p,
                            ),
                          );
                          reset();
                        }}
                      />
                    </td>
                  ),
                )}
                <td>
                  <button
                    aria-label={`Remove process ${i + 1}`}
                    onClick={() => {
                      setJobs((rows) => rows.filter((_, j) => i !== j));
                      reset();
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        disabled={jobs.length >= 20}
        onClick={() => {
          setJobs((rows) => [
            ...rows,
            { id: `P${rows.length + 1}`, arrival: 0, burst: 1, priority: 0 },
          ]);
          reset();
        }}
      >
        Add process
      </button>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        value &&
        frame && (
          <>
            <div className="playback-controls">
              <button
                onClick={() => setPlaying((v) => !v)}
                disabled={step >= value.duration}
              >
                {playing && step < value.duration ? "Pause CPU" : "Play CPU"}
              </button>
              <button
                disabled={!step}
                onClick={() => {
                  setPlaying(false);
                  setStep((s) => s - 1);
                }}
              >
                Previous tick
              </button>
              <button
                disabled={step >= value.duration}
                onClick={() => {
                  setPlaying(false);
                  setStep((s) => s + 1);
                }}
              >
                Next tick
              </button>
              <button onClick={reset}>Rewind CPU</button>
              <strong>t = {frame.time}</strong>
            </div>
            <input
              aria-label="CPU time"
              type="range"
              min={0}
              max={value.duration}
              value={Math.min(step, value.duration)}
              onChange={(e) => {
                setPlaying(false);
                setStep(Number(e.target.value));
              }}
            />
            <div className="gantt" aria-label="Computed Gantt chart">
              {value.timeline.map((block, i) => (
                <button
                  key={i}
                  style={{
                    flexGrow: block.end - block.start,
                    backgroundColor: ["#c8d7f3", "#f8ca39", "#f4afd0"][
                      Math.max(
                        0,
                        jobs.findIndex((job) => job.id === block.id),
                      ) % 3
                    ],
                  }}
                  data-active={
                    frame.time >= block.start && frame.time < block.end
                  }
                  onClick={() => {
                    setStep(block.start);
                    setPlaying(false);
                  }}
                >
                  <strong>{block.id ?? "Idle"}</strong>
                  <span>
                    {block.start}–{block.end}
                  </span>
                </button>
              ))}
            </div>
            <p>{frame.decision}</p>
            <div className="cpu-queues">
              {[
                ["Running", frame.running ? [frame.running] : []],
                ["Ready", frame.ready],
                ["Completed", frame.completed],
              ].map(([label, processes]) => (
                <div key={label as string}>
                  <h3>{label}</h3>
                  {(processes as string[]).map((id) => (
                    <motion.span
                      layout
                      layoutId={`scheduled-process-${id}`}
                      key={id}
                      className="process-chip"
                    >
                      {id}
                    </motion.span>
                  ))}
                </div>
              ))}
            </div>
            <div className="table-scroll">
              <table>
                <caption>
                  Computed final metrics · independent of playback position
                </caption>
                <thead>
                  <tr>
                    <th>Process</th>
                    <th>Completion</th>
                    <th>Turnaround</th>
                    <th>Waiting</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {value.metrics.map((m) => (
                    <tr key={m.id}>
                      <th>{m.id}</th>
                      <td>{m.completion}</td>
                      <td>{m.turnaround}</td>
                      <td>{m.waiting}</td>
                      <td>{m.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Average waiting {value.averages.waiting.toFixed(2)} · turnaround{" "}
              {value.averages.turnaround.toFixed(2)} · response{" "}
              {value.averages.response.toFixed(2)} time units.
            </p>
            <p>
              {value.contextSwitches} context switches: changes between
              different processes in contiguous busy intervals. Idle transitions
              and a process selecting itself are excluded. No switch overhead is
              charged.
            </p>
          </>
        )
      )}
    </section>
  );
}
