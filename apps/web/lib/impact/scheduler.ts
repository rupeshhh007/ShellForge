/** Integer-time single CPU, zero dispatch cost. Pure synthetic process data. */
export type Process = {
  id: string;
  arrival: number;
  burst: number;
  priority: number;
};
export type Policy = "FCFS" | "SJF" | "SRTF" | "RR" | "Priority";
export const POLICIES: Policy[] = ["FCFS", "SJF", "SRTF", "RR", "Priority"];
export function schedule(
  input: readonly Process[],
  policy: Policy,
  quantum = 2,
) {
  if (
    !POLICIES.includes(policy) ||
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > 20
  )
    throw Error("Choose 1–20 processes and a supported policy.");
  if (!Number.isInteger(quantum) || quantum < 1 || quantum > 100)
    throw Error("Quantum must be an integer from 1 to 100.");
  const ids = new Set<string>();
  const jobs = input.map((p, index) => {
    if (
      typeof p.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,12}$/.test(p.id) ||
      ids.has(p.id)
    )
      throw Error(
        "IDs must be unique, 1–12 letters, digits, underscores or hyphens.",
      );
    ids.add(p.id);
    if (
      ![p.arrival, p.burst, p.priority].every(Number.isInteger) ||
      p.arrival < 0 ||
      p.arrival > 1000 ||
      p.burst < 1 ||
      p.burst > 100 ||
      p.priority < 0 ||
      p.priority > 100
    )
      throw Error(
        "Integer limits: arrival 0–1000, burst 1–100, priority 0–100.",
      );
    return { ...p, index, remaining: p.burst, first: -1, finish: -1 };
  });
  type Job = (typeof jobs)[number];
  const ready: Job[] = [];
  const timeline: { start: number; end: number; id: string | null }[] = [];
  const frames: {
    time: number;
    running: string | null;
    ready: string[];
    completed: string[];
    remaining: Record<string, number>;
    decision: string;
  }[] = [];
  let running: Job | undefined,
    expired: Job | undefined,
    time = 0,
    slice = 0,
    finished = 0;
  const tie = (a: Job, b: Job) => a.arrival - b.arrival || a.index - b.index;
  while (finished < jobs.length) {
    for (const job of jobs.filter((p) => p.arrival === time)) ready.push(job);
    // At a quantum boundary, newly arrived jobs precede the expired process.
    if (expired) {
      ready.push(expired);
      expired = undefined;
    }
    if (policy === "SRTF" && running) {
      ready.push(running);
      running = undefined;
    }
    if (!running) {
      if (policy === "SJF")
        ready.sort((a, b) => a.burst - b.burst || tie(a, b));
      if (policy === "SRTF")
        ready.sort((a, b) => a.remaining - b.remaining || tie(a, b));
      if (policy === "Priority")
        ready.sort((a, b) => a.priority - b.priority || tie(a, b));
      running = ready.shift();
      slice = 0;
      if (running && running.first < 0) running.first = time;
    }
    frames.push({
      time,
      running: running?.id ?? null,
      ready: ready.map((p) => p.id),
      completed: jobs.filter((p) => p.finish >= 0).map((p) => p.id),
      remaining: Object.fromEntries(jobs.map((p) => [p.id, p.remaining])),
      decision: running
        ? `${policy}: ${running.id} runs during [${time}, ${time + 1}); ${running.remaining} unit(s) remaining before this tick.`
        : "No arrived process is ready; CPU idle.",
    });
    const previous = timeline.at(-1),
      id = running?.id ?? null;
    if (previous && previous.id === id) previous.end = time + 1;
    else timeline.push({ start: time, end: time + 1, id });
    if (running) {
      running.remaining--;
      slice++;
      if (!running.remaining) {
        running.finish = time + 1;
        finished++;
        running = undefined;
      } else if (policy === "RR" && slice === quantum) {
        expired = running;
        running = undefined;
      }
    }
    time++;
  }
  frames.push({
    time,
    running: null,
    ready: [],
    completed: jobs.map((p) => p.id),
    remaining: Object.fromEntries(jobs.map((p) => [p.id, 0])),
    decision: "All processes completed.",
  });
  const metrics = jobs.map((p) => ({
    id: p.id,
    completion: p.finish,
    turnaround: p.finish - p.arrival,
    waiting: p.finish - p.arrival - p.burst,
    response: p.first - p.arrival,
  }));
  const average = (field: "waiting" | "turnaround" | "response") =>
    metrics.reduce((sum, p) => sum + p[field], 0) / metrics.length;
  const contextSwitches = timeline.reduce(
    (count, segment, i) =>
      count +
      Number(
        i > 0 &&
          segment.id !== null &&
          timeline[i - 1].id !== null &&
          segment.id !== timeline[i - 1].id,
      ),
    0,
  );
  return {
    timeline,
    frames,
    metrics,
    averages: {
      waiting: average("waiting"),
      turnaround: average("turnaround"),
      response: average("response"),
    },
    duration: time,
    contextSwitches,
  };
}
