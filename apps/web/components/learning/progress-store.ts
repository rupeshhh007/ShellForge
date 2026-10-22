"use client";
import { useSyncExternalStore } from "react";
import {
  readProgress,
  type Progress,
  type Action,
} from "@/lib/learning/session";
const KEY = "shellforge-almost-right-v1";
type State = { progress: Progress; warning: string };
const empty: State = { progress: { schema: 1, logs: {} }, warning: "" };
let current: State | undefined;
const listeners = new Set<() => void>();
function read(): State {
  if (current) return current;
  try {
    current = {
      progress: readProgress(localStorage.getItem(KEY)),
      warning: "",
    };
  } catch {
    current = {
      ...empty,
      warning:
        "Saved progress could not be validated. This investigation starts fresh; no stored score was trusted.",
    };
  }
  return current;
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  const sync = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = undefined;
      listeners.forEach((fn) => fn());
    }
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", sync);
  };
}
export function saveActions(id: string, revision: number, actions: Action[]) {
  const state = read();
  const progress = readProgress(
    JSON.stringify({
      schema: 1,
      logs: { ...state.progress.logs, [id]: { revision, actions } },
    }),
  );
  let warning = "";
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    warning =
      "Local storage is unavailable. Progress remains in this tab until reload.";
  }
  current = { progress, warning };
  listeners.forEach((fn) => fn());
}
export function useLearningProgress() {
  return useSyncExternalStore(subscribe, read, () => empty);
}
