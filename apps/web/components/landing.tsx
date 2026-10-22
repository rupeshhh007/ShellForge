"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { KineticCommand } from "./kinetic-command";
import { simulate, seedFilesystem } from "@/lib/impact/engine";
import { isReceipt, readApi, type Receipt } from "@/lib/contracts";
import { useMotionPreference } from "@/lib/use-motion-preference";
export function Landing() {
  const [size, setSize] = useState("+100M"),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const result = useMemo(
    () => simulate(`find ./data -type f -size ${size}`, seedFilesystem()),
    [size],
  );
  const hero = useRef<HTMLElement>(null),
    reduce = useMotionPreference();
  const { scrollYProgress } = useScroll({
      target: hero,
      offset: ["start start", "end start"],
    }),
    rotate = useTransform(scrollYProgress, [0, 1], [0, 12]),
    y = useTransform(scrollYProgress, [0, 1], [0, 70]);
  async function demonstrate() {
    setBusy(true);
    setError("");
    try {
      const v = await readApi("/api/commands/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: "Find files larger than 100 MiB in the current directory",
          profile: "linux",
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!isReceipt(v)) throw Error("Unexpected response");
      setReceipt(v);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="studio-landing">
      <section className="studio-hero page-shell" ref={hero}>
        <div className="hero-copy">
          <h1>
            Understand the command before it <span>changes</span> anything.
          </h1>
          <p className="hero-standfirst">The interactive command laboratory.</p>
          <p>
            Explore operating systems and machine learning through commands you
            can take apart. Every result has a boundary. Every experiment has
            evidence.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/lab" data-cursor="Explore">
              Open the Lab ↗
            </Link>
            <Link className="text-link" href="/studio">
              Explore Model Studio →
            </Link>
          </div>
        </div>
        <motion.div
          className="hero-art"
          style={reduce ? {} : { rotate, y }}
          data-cursor="Inspect"
        >
          <Image
            src="/artwork/terminal-studio.webp"
            width={1100}
            height={733}
            priority
            alt="Original evergreen terminal sculpture with pink and yellow folders on a cobalt paper orbit"
          />
          <span className="art-note">Take a command apart.</span>
        </motion.div>
        <div className="hero-preview">
          <div>
            <code>find ./data -type f -size {size}</code>
            <span>{result.matches.length} matched virtual files</span>
          </div>
          <div
            className="preview-options"
            role="group"
            aria-label="Compare size predicates"
          >
            <button
              aria-pressed={size === "100M"}
              onClick={() => setSize("100M")}
            >
              Rounded size
            </button>
            <button
              aria-pressed={size === "+100M"}
              onClick={() => setSize("+100M")}
            >
              Larger than 100 MiB
            </button>
            <button
              aria-pressed={size === "104857600c"}
              onClick={() => setSize("104857600c")}
            >
              Exact bytes
            </button>
          </div>
          <p className="comparison-explanation">
            {size === "100M"
              ? "GNU find rounds upward: larger than 99 MiB and at most 100 MiB match this bucket."
              : size === "+100M"
                ? "Logical size strictly greater than 104,857,600 bytes."
                : "Only a logical size of exactly 104,857,600 bytes matches."}
          </p>
          <ul>
            {result.matches.map((path) => (
              <motion.li
                layout
                key={path}
                initial={false}
                animate={{ opacity: 1 }}
              >
                <code>{path}</code>
              </motion.li>
            ))}
          </ul>
          <Link
            href={`/lab?command=${encodeURIComponent(`find ./data -type f -size ${size}`)}`}
          >
            Follow these matches in the Lab →
          </Link>
        </div>
      </section>
      <section className="three-worlds page-shell">
        <h2>
          Three ways to
          <br />
          <em>get your hands on it.</em>
        </h2>
        <div className="world-collage">
          <Link
            href="/forge"
            className="world-forge"
            aria-label="Enter the Forge"
            data-cursor="Open"
          >
            <span className="world-symbol" aria-hidden="true">
              &gt;_
            </span>
            <h3>The Forge</h3>
            <p>
              Turn a supported request into a command. Inspect every token
              before taking it further.
            </p>
            <span>Enter the Forge →</span>
          </Link>
          <Link href="/lab" className="world-lab" data-cursor="Explore">
            <span className="world-symbol" aria-hidden="true">
              r<span>w</span>x
            </span>
            <h3>The Lab</h3>
            <p>
              Walk a synthetic filesystem, flip permission bits, and see who
              gets the CPU.
            </p>
            <span>Open an experiment →</span>
          </Link>
          <Link href="/studio" className="world-model" data-cursor="Inspect">
            <span className="world-symbol" aria-hidden="true">
              ↳ ↱
            </span>
            <h3>Model Studio</h3>
            <p>
              Compare actual base and tuned predictions. Keep improvements and
              failures in the same frame.
            </p>
            <span>Read the evidence →</span>
          </Link>
        </div>
      </section>
      <section className="command-story">
        <div className="page-shell">
          <div className="story-heading">
            <h2>
              A command is
              <br />a chain of <em>decisions.</em>
            </h2>
            <p>
              Focus a token. Assemble its parts. Then follow its actual effects
              in the virtual filesystem.
            </p>
          </div>
          <KineticCommand />
          <Link
            className="button"
            href="/lab?command=find%20.%20-type%20f%20-size%20%2B100M"
          >
            Trace this command →
          </Link>
        </div>
      </section>
      <section className="workflow-story page-shell">
        <h2>
          Proposal. Inspection.
          <br />
          <span>Virtual consequence.</span>
        </h2>
        <ol>
          <li>
            <strong>Describe</strong>
            <p>
              Twelve strict templates handle supported requests. A separate live
              model runtime is available only when connected.
            </p>
          </li>
          <li>
            <strong>Inspect</strong>
            <p>
              Bash syntax checking and the static safety policy explain
              findings. They do not establish semantic correctness.
            </p>
          </li>
          <li>
            <strong>Experiment</strong>
            <p>
              The bounded interpreter touches synthetic data structures only.
              Preview a change, apply it in memory, then undo.
            </p>
          </li>
        </ol>
        <button className="button" onClick={demonstrate} disabled={busy}>
          {busy ? "Waiting for the API…" : "Try the real example"}
        </button>
        {receipt && (
          <div className="demo-output">
            <code>{receipt.command}</code>
            <p>
              {receipt.backend} · {receipt.safety?.risk} · executed: false
            </p>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
      <section id="invitation" className="research-invitation">
        <div className="page-shell">
          <h2>
            Better is measurable.
            <br />
            <em>Reliable is a higher bar.</em>
          </h2>
          <div className="honest-numbers">
            <div>
              <strong>2.29%</strong>
              <span>Base strict exact match · 28 / 1,222</span>
            </div>
            <div>
              <strong>6.87%</strong>
              <span>Selected rank-16 · 84 / 1,222</span>
            </div>
          </div>
          <p>
            A real improvement with a low absolute score. These are primary
            held-out results, excluding the exposed CPU pilot. Static safety has
            a separate benchmark.
          </p>
          <Link className="button" href="/studio">
            Explore the actual predictions ↗
          </Link>
          <Link className="text-link" href="/bench">
            Research, methods & limitations →
          </Link>
        </div>
      </section>
    </main>
  );
}
