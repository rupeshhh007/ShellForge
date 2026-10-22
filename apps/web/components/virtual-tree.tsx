"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  basename,
  parent,
  modeString,
  type Snapshot,
  type Result,
  type Entry,
} from "@/lib/impact/engine";
import { useMotionPreference } from "@/lib/use-motion-preference";
export function VirtualTree({
  snapshot,
  result,
  selected,
  onSelect,
  token,
  showAfter,
}: {
  snapshot: Snapshot;
  result: Result;
  selected: string;
  onSelect: (path: string) => void;
  token: number;
  showAfter: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set(["/lab/home", "/lab/logs", "/lab/private"]),
  );
  const reduce = useMotionPreference();
  const entries = showAfter ? result.after.entries : snapshot.entries;
  const childMap = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = childMap.get(parent(entry.path)) ?? [];
    list.push(entry);
    childMap.set(parent(entry.path), list);
  }
  for (const list of childMap.values())
    list.sort((a, b) => a.path.localeCompare(b.path, "en"));
  function render(entry: Entry, depth: number): React.ReactNode {
    const open = !collapsed.has(entry.path),
      match = result.matches.includes(entry.path),
      visited = result.visited.includes(entry.path);
    const trace = result.traces[entry.path]?.find(
      (t) => t.token === token || t.token === token - 1,
    );
    const denied = result.errors.some((error) => error.endsWith(entry.path));
    const changed = result.changes.find((c) => c.path === entry.path);
    return (
      <motion.li
        key={entry.path}
        layout={!reduce}
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, height: 0 }}
      >
        <motion.div
          className={`vfs-row ${selected === entry.path ? "selected" : ""} ${match ? "matched" : ""} ${trace?.passed ? "predicate-pass" : ""}`}
          data-path={entry.path}
          data-denied={denied}
          data-match={match}
          data-visited={visited}
          layout={!reduce}
          animate={{ backgroundColor: match ? "#d9ebd8" : "#f5efe4" }}
          transition={{ duration: reduce ? 0 : 0.25 }}
          style={{ paddingLeft: 12 + depth * 16 }}
        >
          {entry.kind === "directory" ? (
            <button
              className="vfs-disclosure"
              aria-label={`${open ? "Collapse" : "Expand"} ${entry.path}`}
              aria-expanded={open}
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (open) next.add(entry.path);
                  else next.delete(entry.path);
                  return next;
                })
              }
            >
              {open ? "−" : "+"}
            </button>
          ) : (
            <span className="vfs-file-dot" aria-hidden="true">
              ·
            </span>
          )}
          <button
            className="vfs-name"
            onClick={() => onSelect(entry.path)}
            aria-pressed={selected === entry.path}
            aria-label={`Properties ${entry.path}`}
          >
            <span aria-hidden="true">
              {entry.kind === "directory" ? "▱" : "▤"}
            </span>{" "}
            {entry.path === "/lab" ? "/lab" : basename(entry.path)}
            {entry.kind === "directory" ? "/" : ""}
          </button>
          <span className="vfs-mode">{modeString(entry.mode)}</span>
          <span className="vfs-size">
            {entry.kind === "directory"
              ? "dir"
              : `${entry.size.toLocaleString("en-US")} B`}
          </span>
          <span
            className="vfs-match"
            aria-label={
              match
                ? "Matched"
                : visited
                  ? "Visited; not matched"
                  : "Not visited"
            }
          >
            {denied
              ? "!"
              : changed
                ? showAfter
                  ? "+"
                  : "Δ"
                : match
                  ? "●"
                  : visited
                    ? "○"
                    : "·"}
          </span>
        </motion.div>
        {entry.kind === "directory" && (
          <AnimatePresence initial={false}>
            {open && (
              <motion.ul
                key={`${entry.path}-children`}
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.22 }}
              >
                <AnimatePresence initial={false}>
                  {(childMap.get(entry.path) ?? []).map((child) =>
                    render(child, depth + 1),
                  )}
                </AnimatePresence>
              </motion.ul>
            )}
          </AnimatePresence>
        )}
      </motion.li>
    );
  }
  return (
    <ul
      className="virtual-tree"
      aria-label="Synthetic filesystem directories and files"
    >
      {entries.filter((e) => e.path === "/lab").map((e) => render(e, 0))}
    </ul>
  );
}
