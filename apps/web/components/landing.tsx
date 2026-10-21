"use client";

import { useMotionPreference } from "@/lib/use-motion-preference";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { isReceipt, readApi, type Receipt } from "@/lib/contracts";
import { ChapterRail } from "./chapter-rail";

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useMotionPreference();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

export function Landing() {
  const reduce = useMotionPreference();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 90, damping: 22 });
  const rotateY = useSpring(x, { stiffness: 90, damping: 22 });
  const [greater, setGreater] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function demonstrate() {
    setBusy(true);
    setError("");
    setReceipt(null);
    try {
      const result = await readApi("/api/commands/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: "Find files larger than 100 MiB in the current directory",
          profile: "linux",
        }),
      });
      if (!isReceipt(result))
        throw new Error(
          "The API response did not match the expected contract.",
        );
      setReceipt(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the API.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="landing">
      <section
        className="hero page-shell"
        aria-labelledby="hero-title"
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          const rect = e.currentTarget.getBoundingClientRect();
          x.set(((e.clientX - rect.left) / rect.width - 0.5) * 7);
          y.set(-((e.clientY - rect.top) / rect.height - 0.5) * 5);
        }}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        <motion.div
          className="hero-art"
          style={reduce ? {} : { rotateX, rotateY }}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1 }}
        >
          <Image
            src="/artwork/command-sculpture.webp"
            alt="An original copper command bracket and brushed silver slash, crafted as a precision sculpture"
            width={1000}
            height={1000}
            priority
            sizes="(max-width: 600px) 90vw, 50vw"
          />
          <span className="art-label mono">
            Fig. 01 — Intent, made tangible.
          </span>
        </motion.div>
        <motion.div
          className="hero-copy"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
        >
          <h1 id="hero-title">
            Less guesswork.
            <br />
            <em>More command.</em>
          </h1>
          <p className="hero-description">
            Describe the operation.
            <br />
            Understand the command.
            <br />
            Inspect the consequences.
          </p>
          <Link href="/forge" className="button hero-cta">
            Enter the Forge <span aria-hidden="true">↗</span>
          </Link>
          <p className="hero-note mono">
            A thoughtful tool for a powerful shell.
          </p>
        </motion.div>
        <div className="hero-command">
          <span className="mono hero-command-label">
            A proposal, never an execution
          </span>
          <Link
            href="/forge?example=large-files"
            aria-label="Try the find large files example in the Forge"
          >
            <span className="prompt-symbol" aria-hidden="true">
              $
            </span>
            <code>
              find . -type f -size <span>+100M</span>
            </code>
            <span className="command-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
      </section>

      <div className="page-shell">
        <ChapterRail />
      </div>

      <section
        id="precision"
        className="story-section precision-section page-shell"
      >
        <Reveal className="section-intro">
          <span className="section-number mono">01 / Precision matters</span>
          <h2>
            One character.
            <br />
            <em>A different consequence.</em>
          </h2>
          <p>
            The shell takes you literally. That tiny plus sign changes which
            files you find. Understand the difference before it becomes a
            decision.
          </p>
        </Reveal>
        <Reveal className="comparison-instrument">
          <div className="instrument-heading mono">
            <span>GNU FIND / SIZE STUDY</span>
            <span>1 MiB = 1,048,576 bytes</span>
          </div>
          <div
            className="compare-controls"
            role="group"
            aria-label="Choose the size comparison"
          >
            <button onClick={() => setGreater(false)} aria-pressed={!greater}>
              Rounded size
            </button>
            <button onClick={() => setGreater(true)} aria-pressed={greater}>
              Greater than
            </button>
          </div>
          <div className="comparison-command">
            <code>
              find . -size{" "}
              <motion.span
                key={String(greater)}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {greater ? "+100M" : "100M"}
              </motion.span>
            </code>
          </div>
          <div className="size-diagram" aria-hidden="true">
            <div className={greater ? "size-block" : "size-block selected"} />
            <div className={greater ? "size-block selected" : "size-block"} />
            <div className={greater ? "size-block selected" : "size-block"} />
            <div className="size-tick left">99 MiB</div>
            <div className="size-tick middle">100 MiB</div>
            <div className="size-tick right">101 MiB →</div>
          </div>
          <div className="comparison-explanation" aria-live="polite">
            <h3>
              {greater
                ? "Beyond the threshold."
                : "A rounded bucket, not exact bytes."}
            </h3>
            <p>
              {greater
                ? "+100M matches files strictly larger than 100 MiB. GNU find rounds size upward in 1 MiB units before comparing."
                : "100M matches files larger than 99 MiB and up to 100 MiB inclusive. For exactly 104,857,600 bytes, use -size 104857600c."}
            </p>
          </div>
          <a
            className="text-link"
            href="https://www.gnu.org/software/findutils/manual/html_node/find_html/Size.html"
          >
            Read the GNU find size semantics ↗
          </a>
        </Reveal>
      </section>

      <section id="transformation" className="transformation-section">
        <div className="page-shell">
          <Reveal className="transformation-intro">
            <span className="section-number mono">
              02 / From language to logic
            </span>
            <h2>
              Say what you mean.
              <br />
              <em>See what it means.</em>
            </h2>
            <p>
              For supported operations, a bounded template turns your request
              into explicit constraints. Every proposal comes apart for
              inspection.
            </p>
          </Reveal>
          <div className="live-demonstration">
            <div className="demo-request">
              <span className="mono">YOUR INTENT</span>
              <p>
                “Find files larger than 100 MiB
                <br />
                in the current directory.”
              </p>
              <button
                className="button light"
                disabled={busy}
                onClick={demonstrate}
              >
                {busy
                  ? "Requesting proposal…"
                  : receipt
                    ? "Try it again"
                    : "Try the real example"}
                <span aria-hidden="true">↗</span>
              </button>
              <span className="demo-caption mono">
                Live API · deterministic template
              </span>
            </div>
            <div className="demo-output" aria-live="polite" aria-busy={busy}>
              {error ? (
                <p role="alert" className="error-message">
                  {error}
                </p>
              ) : receipt?.command ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="mono">PROPOSED BASH</span>
                  <code>{receipt.command}</code>
                  <dl>
                    <div>
                      <dt>Target</dt>
                      <dd>Regular files</dd>
                    </div>
                    <div>
                      <dt>Condition</dt>
                      <dd>More than 100 MiB</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>Recursive</dd>
                    </div>
                  </dl>
                  <Link href="/forge?example=large-files" className="text-link">
                    Inspect every token in the Forge ↗
                  </Link>
                </motion.div>
              ) : (
                <div className="demo-empty">
                  <span aria-hidden="true">→</span>
                  <p>
                    {busy
                      ? "Waiting for the actual API response."
                      : "Your command will appear here."}
                  </p>
                  <span className="mono">
                    Nothing runs. Nothing is simulated.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="verification" className="verification-section page-shell">
        <Reveal>
          <span className="section-number mono">
            03 / Understand the limits
          </span>
          <div className="verification-heading">
            <h2>
              Confidence comes
              <br />
              from <em>looking closer.</em>
            </h2>
            <p>
              A command can parse perfectly and still be wrong for your task.
              Our checks are a starting point for your judgment.
            </p>
          </div>
        </Reveal>
        <div className="verification-steps">
          {[
            [
              "01",
              "Syntax",
              "Does Bash parse it?",
              "A syntax-only check catches malformed shell structure. It does not prove the command will work.",
            ],
            [
              "02",
              "Static policy",
              "What deserves attention?",
              "AST rules flag recognized deletion, writes, wrappers and other risks. Unknown behavior needs review.",
            ],
            [
              "03",
              "Your review",
              "Does it match your intent?",
              "You know the environment. Check the paths, units, permissions and consequences before running anything.",
            ],
          ].map(([number, title, subtitle, body]) => (
            <Reveal key={title} className="verification-step">
              <span className="mono">{number} /</span>
              <h3>{title}</h3>
              <strong>{subtitle}</strong>
              <p>{body}</p>
            </Reveal>
          ))}
        </div>
        <Link href="/xray" className="text-link">
          Bring your own command to X-Ray ↗
        </Link>
      </section>

      <section id="invitation" className="invitation-section page-shell">
        <span className="section-number mono">04 / The workshop is open</span>
        <h2>
          Make your next
          <br />
          command <em>considered.</em>
        </h2>
        <div>
          <p>
            Start with a supported operation.
            <br />
            Leave with a command you understand.
          </p>
          <Link href="/forge" className="button">
            Enter the Forge <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/manual" className="text-link">
            Or open the Field Manual ↗
          </Link>
        </div>
      </section>
    </main>
  );
}
