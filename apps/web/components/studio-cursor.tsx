"use client";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
export function StudioCursor() {
  const x = useMotionValue(-100),
    y = useMotionValue(-100),
    sx = useSpring(x, { stiffness: 240, damping: 28 }),
    sy = useSpring(y, { stiffness: 240, damping: 28 });
  const [label, setLabel] = useState("");
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (
        !matchMedia("(pointer:fine) and (prefers-reduced-motion:no-preference)")
          .matches
      ) {
        setLabel("");
        return;
      }
      const target = (event.target as Element).closest<HTMLElement>(
        "[data-cursor]",
      );
      if (
        !target ||
        (event.target as Element).closest("input,textarea,select,code")
      ) {
        setLabel("");
        return;
      }
      const rect = target.getBoundingClientRect();
      x.set(
        event.clientX + (rect.left + rect.width / 2 - event.clientX) * 0.07,
      );
      y.set(
        event.clientY + (rect.top + rect.height / 2 - event.clientY) * 0.07,
      );
      setLabel(target.dataset.cursor ?? "");
    };
    const leave = () => setLabel("");
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [x, y]);
  return (
    <motion.div
      aria-hidden="true"
      className="studio-cursor"
      style={{ x: sx, y: sy, opacity: label ? 1 : 0 }}
    >
      {label}
    </motion.div>
  );
}
