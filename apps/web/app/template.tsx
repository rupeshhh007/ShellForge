"use client";

import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useMotionPreference();
  return (
    <>
      <motion.div
        aria-hidden="true"
        className="route-shutter"
        initial={reduce ? false : { scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        className="route-content"
        initial={reduce ? false : { y: 32 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </>
  );
}
