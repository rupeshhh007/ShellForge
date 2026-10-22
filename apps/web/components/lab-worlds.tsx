"use client";
import { useState } from "react";
import { FocusPanel } from "./focus-panel";
import { SchedulingLab } from "./scheduling-lab";
import { PermissionEditor } from "./permission-editor";
import { useImpactSession } from "./impact-session";
import { simulate, LIMITS, modeString } from "@/lib/impact/engine";
export function LabWorlds() {
  return (
    <div className="lab-worlds page-shell">
      <div className="world-intro">
        <h1>
          The Lab<span className="hand-loop">.</span>
        </h1>
        <p>
          Take an operating system apart.
          <br />
          Change one thing. See exactly what follows.
        </p>
      </div>
      <div className="experiment-grid">
        <a className="experiment-card forest" href="#filesystem">
          <div className="experiment-art folder-art" aria-hidden="true">
            <span>find</span>
            <span>./data</span>
            <span>+100M</span>
          </div>
          <h2>Follow every file.</h2>
          <span>Filesystem & command impact ↓</span>
        </a>
        <FocusPanel
          title="Permissions, bit by bit."
          tone="pink"
          art={
            <div className="bits-art" aria-hidden="true">
              r<span>w</span>x<br />
              <small>7 &nbsp; 5 &nbsp; 5</small>
            </div>
          }
        >
          <PermissionExperiment />
        </FocusPanel>
        <FocusPanel
          title="Who gets the CPU?"
          tone="blue"
          art={
            <div className="schedule-art" aria-hidden="true">
              <span>A</span>
              <span>B</span>
              <span>A</span>
              <span>C</span>
            </div>
          }
        >
          <SchedulingLab />
        </FocusPanel>
      </div>
    </div>
  );
}
function PermissionExperiment() {
  const session = useImpactSession(),
    [path, setPath] = useState("/lab/data/nested"),
    [command, setCommand] = useState("find ./data/nested -maxdepth 1");
  const result = simulate(command, session.snapshot),
    entry = session.snapshot.entries.find((e) => e.path === path)!;
  return (
    <>
      <label>
        Virtual entry
        <select
          aria-label="Permission entry"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        >
          {session.snapshot.entries.map((e) => (
            <option key={e.path}>{e.path}</option>
          ))}
        </select>
      </label>
      <p>
        uid 1000 · gid 1000 · owner {entry.uid} · current mode{" "}
        {modeString(entry.mode)}
      </p>
      <PermissionEditor
        entry={entry}
        previewMode={
          result.program?.utility === "chmod" ? result.program.mode : undefined
        }
        onCommand={setCommand}
      />
      <code className="command-display">{command}</code>
      <p role="status">{result.message}</p>
      <ul>
        {result.errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
        {result.changes.map((c) => (
          <li key={c.path}>
            {c.path}: {c.before ? modeString(c.before.mode) : "absent"} →{" "}
            {c.after ? modeString(c.after.mode) : "absent"}
          </li>
        ))}
      </ul>
      <p>
        {result.visited.length} visited · {result.matches.length} matches
      </p>
      <div className="playback-controls">
        <button
          disabled={result.status !== "ok" || !result.changes.length}
          onClick={() => {
            session.setHistory((h) =>
              [...h, session.snapshot].slice(-LIMITS.history),
            );
            session.setSnapshot(result.after);
            session.setApplied({
              command,
              changes: result.changes,
              revision: result.after.revision,
            });
            setCommand(`find '${path}' -maxdepth 1`);
          }}
        >
          Apply permission preview
        </button>
        <button
          disabled={!session.history.length}
          onClick={() => {
            session.setSnapshot(session.history.at(-1)!);
            session.setHistory((h) => h.slice(0, -1));
            session.setApplied(null);
          }}
        >
          Undo permission change
        </button>
      </div>
      <p>
        Use /lab/data/nested to remove search permission; use /lab/private to
        test root ownership; preview removal of /lab/tmp/root-owned.tmp to see
        sticky-bit protection.
      </p>
    </>
  );
}
