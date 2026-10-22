"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

// Hydration must use the same snapshot as SSR. CSS also removes motion before JS
// loads, so reduced-motion users never wait for the client preference snapshot.
export function useMotionPreference() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
