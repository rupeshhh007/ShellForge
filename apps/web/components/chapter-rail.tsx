"use client";

import { useMotionPreference } from "@/lib/use-motion-preference";

/**
 * Adapted from Rare UI Rail TOC — Copyright (c) 2026 Swami Malode.
 * https://github.com/swamimalode07/rare-ui/blob/main/components/ui/rail-toc.tsx
 * MIT + Commons Clause + Attribution; full notice in licenses/rare-ui.txt.
 * Reduced to a horizontal chapter instrument; no copied artwork or plane.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

const chapters = [
  { id: "precision", label: "The difference" },
  { id: "transformation", label: "The process" },
  { id: "verification", label: "The review" },
  { id: "invitation", label: "The workshop" },
];
const TRAVEL_SPRING = { stiffness: 140, damping: 26, mass: 0.6 };

export function ChapterRail() {
  const reduce = useMotionPreference();
  const [active, setActive] = useState(0);
  const rail = useRef<HTMLElement>(null);
  const target = useMotionValue(0);
  const travel = useSpring(target, TRAVEL_SPRING);
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      const tops = chapters.map(
        (item) =>
          document.getElementById(item.id)?.getBoundingClientRect().top ??
          Infinity,
      );
      let index = tops.findLastIndex((top) => top <= window.innerHeight * 0.42);
      index = Math.max(0, index);
      setActive(index);
      target.set(
        (index * (rail.current?.clientWidth ?? 400)) / chapters.length,
      );
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [target]);
  return (
    <nav ref={rail} className="chapter-rail" aria-label="Story chapters">
      <motion.span
        className="chapter-indicator"
        style={{ x: reduce ? target : travel }}
        aria-hidden="true"
      />
      {chapters.map((item, i) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={i === active ? "location" : undefined}
        >
          <span>0{i + 1}</span>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
