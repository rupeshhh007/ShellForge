"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const fragments = [
  {
    text: "find",
    role: "Utility",
    detail: "Walk a directory tree.",
    width: 164,
  },
  {
    text: ".",
    role: "Starting path",
    detail: "Begin in the current directory.",
    width: 82,
  },
  {
    text: "-type",
    role: "Type predicate",
    detail: "Filter by the kind of filesystem entry.",
    width: 180,
  },
  {
    text: "f",
    role: "Regular files",
    detail: "Match regular files, rather than directories.",
    width: 82,
  },
  {
    text: "-size",
    role: "Size predicate",
    detail: "Compare the rounded file size.",
    width: 180,
  },
  {
    text: "+100M",
    role: "Size constraint",
    detail: "Match files larger than 100 MiB in GNU find.",
    width: 224,
  },
];

/** An actual, accessible type assembly. Every plate is independently animated. */
export function KineticCommand() {
  const reduce = useMotionPreference();
  const ref = useRef<HTMLDivElement>(null);
  const [apart, setApart] = useState(true);
  const [active, setActive] = useState(5);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateY = useSpring(pointerX, { stiffness: 90, damping: 20 });
  const rotateX = useSpring(pointerY, { stiffness: 90, damping: 20 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scrollY = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const scrollRotate = useTransform(scrollYProgress, [0, 1], [-8, 6]);

  return (
    <div
      className="kinetic-command"
      ref={ref}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        pointerX.set(((e.clientX - r.left) / r.width - 0.5) * 18);
        pointerY.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
      }}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <div className="assembly-controls">
        <span className="mono">GNU FIND / ANATOMY STUDY</span>
        <button onClick={() => setApart(!apart)} aria-pressed={!apart}>
          {apart ? "Assemble" : "Pull apart"}
          <span aria-hidden="true">{apart ? "↙" : "↗"}</span>
        </button>
      </div>
      <motion.div
        className="assembly-perspective"
        style={reduce ? {} : { y: scrollY, rotate: scrollRotate }}
      >
        <motion.div
          className="assembly-plates"
          style={reduce ? {} : { rotateX, rotateY }}
        >
          {fragments.map((fragment, i) => (
            <motion.button
              key={fragment.text}
              className={`assembly-plate ${i === active ? "active" : ""}`}
              style={{ width: fragment.width }}
              initial={
                reduce
                  ? false
                  : {
                      opacity: 0,
                      x: (i - 2.5) * 100,
                      y: 180,
                      rotateY: -75,
                      rotateZ: -20,
                    }
              }
              animate={{
                opacity: 1,
                x: apart ? (i - 2.5) * 16 : 0,
                y: apart ? [22, -30, 15, -40, 8, -22][i] : 0,
                rotateY: apart ? -24 : 0,
                rotateZ: apart ? -5 : 0,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 90,
                      damping: 17,
                      delay: i * 0.065,
                    }
              }
              whileHover={
                reduce
                  ? {}
                  : {
                      y: -66,
                      z: 80,
                      rotateY: 0,
                      transition: {
                        type: "spring",
                        stiffness: 240,
                        damping: 19,
                        delay: 0,
                      },
                    }
              }
              onFocus={() => setActive(i)}
              onPointerEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-pressed={active === i}
              aria-label={`${fragment.text}: ${fragment.role}`}
            >
              <span className="plate-fastener top" />
              <code>{fragment.text}</code>
              <span className="plate-fastener bottom" />
              <span className="plate-number mono">0{i + 1}</span>
            </motion.button>
          ))}
        </motion.div>
        <div className="assembly-axis" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </motion.div>
      <div className="assembly-caption" aria-live="polite">
        <span className="mono">
          0{active + 1} / {fragments[active].role}
        </span>
        <motion.p
          key={active}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {fragments[active].detail}
        </motion.p>
      </div>
    </div>
  );
}
