"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CASES } from "@/lib/learning/cases";
import { conceptEvidence } from "@/lib/learning/session";
import { useLearningProgress } from "./progress-store";
import { LessonExperience } from "./lesson-experience";
import { FocusDialog } from "../focus-panel";
export function CaseGallery({
  sourceCommit = "local",
}: {
  sourceCommit?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    progress = useLearningProgress(),
    evidence = conceptEvidence(progress.progress);
  return (
    <main id="main" className="arl-gallery page-shell">
      <section className="arl-gallery-intro">
        <div>
          <p className="arl-identity">ShellForge · The Almost Right Lab</p>
          <h1>
            One character can
            <br />
            change <em>everything.</em>
          </h1>
          <p>
            A museum of Linux mistakes. Make a prediction, follow the evidence,
            and prove what actually changed.
          </p>
          <Link className="button" href="/cases/missing-100">
            Open the 100 MiB case →
          </Link>
        </div>
        <div className="arl-gallery-art" data-cursor="Investigate">
          <Image
            src="/artwork/almost-right-evidence.webp"
            alt="Original sculptural evidence folder and magnifying lens examining a plus symbol"
            width={1000}
            height={667}
            priority
          />
          <span>Predict. Investigate. Prove.</span>
        </div>
      </section>
      <section className="arl-exhibits" aria-label="Case gallery">
        <div className="arl-exhibits-heading">
          <h2>
            Every mistake
            <br />
            leaves <em>evidence.</em>
          </h2>
          <p>
            Four complete investigations. Every result comes from code. No
            account or AI request is needed.
          </p>
        </div>
        <div className="arl-dossier-shelf">
          {CASES.map((lesson) => (
            <motion.button
              layoutId={`focus-${lesson.id}`}
              key={lesson.id}
              className={`arl-dossier arl-cover-${lesson.theme}`}
              onClick={() => setSelected(lesson.id)}
              data-cursor="Open"
            >
              <div className="arl-cover-graphic" aria-hidden="true">
                {lesson.theme === "size" ? (
                  <>
                    <span>100M</span>
                    <b>+</b>
                  </>
                ) : lesson.theme === "permissions" ? (
                  <>
                    <span className="arl-door">
                      r w <i>x</i>
                    </span>
                  </>
                ) : lesson.theme === "sticky" ? (
                  <>
                    <span className="arl-seal">t</span>
                    <small>rwx</small>
                  </>
                ) : (
                  <>
                    <span>≈</span>
                    <b>?</b>
                  </>
                )}
              </div>
              <span className="arl-dossier-concepts">
                {lesson.concepts.join(" · ")}
              </span>
              <h3>{lesson.shortTitle}</h3>
              <p>{lesson.intro}</p>
              <span className="arl-open-case">Open case file ↗</span>
              {progress.progress.logs[lesson.id] && (
                <span className="arl-local-note">
                  Local investigation in progress / recorded
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </section>
      <section className="arl-concept-map">
        <h2>Your evidence of practice.</h2>
        <p>
          Local to this browser. These counts describe attempts and follow-up
          answers, not measured mastery or educational improvement.
        </p>
        {Object.keys(evidence).length ? (
          <ul>
            {Object.entries(evidence).map(([name, row]) => (
              <li key={name}>
                <strong>{name}</strong>
                <span>
                  {row.investigations} investigations · {row.firstCorrect} first
                  predictions agreed · {row.transferCorrect} follow-ups agreed
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="arl-empty-evidence">
            Open a case and commit a prediction. Your concept trail begins
            there.
          </p>
        )}
      </section>
      <div className="arl-tool-links">
        <Link href="/lab">Free-form filesystem & CPU lab ↗</Link>
        <Link href="/studio">Original model evidence ↗</Link>
        <Link href="/forge" aria-label="Enter the Forge">
          Enter the Forge ↗
        </Link>
        <Link href="/workshop">Command anatomy workshop ↗</Link>
        <Link href="/bench">Formal research ↗</Link>
      </div>
      <AnimatePresence>
        {selected && (
          <FocusDialog
            id={selected}
            title={CASES.find((c) => c.id === selected)!.title}
            onClose={() => setSelected(null)}
          >
            <LessonExperience
              key={selected}
              id={selected}
              sourceCommit={sourceCommit}
              embedded
            />
          </FocusDialog>
        )}
      </AnimatePresence>
    </main>
  );
}
