import { ResearchComparison } from "@/components/research-comparison";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
export const metadata: Metadata = {
  title: "The Bench — Research & reliability",
};
const source = "https://github.com/rupeshhh007/ShellForge/blob/main";

export default function Bench() {
  return (
    <main id="main" className="page-shell bench-page">
      <div className="bench-heading">
        <div>
          <span className="section-number mono">
            The Bench / Research notes 001
          </span>
          <h1>
            Measured.
            <br />
            <em>Not mythologized.</em>
          </h1>
        </div>
        <p>
          Useful tools earn trust through clear boundaries. Here is what
          ShellForge’s research actually tells us.
        </p>
      </div>
      <section className="bench-lead">
        <div className="bench-number">
          <span>
            6.87<small>%</small>
          </span>
          <p className="mono">
            STRICT EXACT MATCH
            <br />
            84 / 1,222 held-out cases
          </p>
        </div>
        <div>
          <h2>
            An improvement.
            <br />
            Still an experiment.
          </h2>
          <p>
            The final rank-16 Qwen2.5-0.5B-Instruct LoRA adapter matched 84
            reference commands exactly, compared with 28 for the base model.
            That is strict command-byte agreement under the saved evaluation
            protocol.
          </p>
          <p>
            <strong>
              It is not semantic correctness, real-world task success, or
              production reliability.
            </strong>{" "}
            Equivalent commands may not match. Incorrect commands may still
            parse.
          </p>
          <a
            href={`${source}/reports/ShellForge_Review2.md`}
            className="text-link"
          >
            Read the completed research report ↗
          </a>
        </div>
      </section>
      <ResearchComparison />
      <section className="bench-section">
        <div className="bench-section-heading">
          <span className="mono">01 / THE EXPERIMENT RECORD</span>
          <h2>The whole comparison.</h2>
        </div>
        <div className="bench-table-wrap">
          <table>
            <caption>Generation experiments — strict exact match only</caption>
            <thead>
              <tr>
                <th scope="col">Evaluation</th>
                <th scope="col">Base</th>
                <th scope="col">LoRA</th>
                <th scope="col">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">CPU pilot · 32 cases</th>
                <td>3 / 32</td>
                <td>2 / 32</td>
                <td>Negative pilot; preserved</td>
              </tr>
              <tr>
                <th scope="row">Full validation · 1,255 cases</th>
                <td>36 / 1,255</td>
                <td>Trial 1: 97 · Trial 2: 98</td>
                <td>Validation selects the final trial</td>
              </tr>
              <tr className="primary-result">
                <th scope="row">Primary test · 1,222 cases</th>
                <td>28 · 2.29%</td>
                <td>84 · 6.87%</td>
                <td>Excludes 32 pilot-exposed cases</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Final Colab T4 training used 10,026 examples, rank 16, 1,500 optimizer
          steps and 2.393 epochs. The primary test was evaluated after trial
          selection. The small rank-8 adapter in the repository is the
          historical CPU pilot; the final adapter remains in Drive.
        </p>
      </section>
      <section className="bench-section safety-study">
        <div>
          <span className="mono">02 / A SEPARATE QUESTION</span>
          <h2>
            Static policy has
            <br />
            its own benchmark.
          </h2>
          <p>
            The conservative AST safety validator scored approximately{" "}
            <strong>0.9817 macro F1 on 102 authored examples</strong>, with zero
            dangerous false negatives and two benign compound-command false
            positives in that set.
          </p>
          <p>
            The benchmark was assistant-authored and used during policy
            development. It has no independent adjudication and does not
            demonstrate adversarial generalization.{" "}
            <strong>
              This score is not the language model’s generation accuracy.
            </strong>
          </p>
          <a href={`${source}/benchmarks/README.md`} className="text-link">
            Inspect the safety benchmark ↗
          </a>
        </div>
        <figure>
          <Image
            src="/artwork/syntax-map.svg"
            alt="Original branching diagram separating a find utility into its starting path, regular-file predicate and size threshold"
            width={760}
            height={480}
          />
          <figcaption className="mono">
            STRUCTURE CAN BE INSPECTED. INTENT STILL NEEDS REVIEW.
          </figcaption>
        </figure>
      </section>
      <section className="bench-section">
        <span className="mono">03 / WHERE THE BOUNDARY IS</span>
        <h2>What the checks cannot tell you.</h2>
        <div className="limits-list">
          <article>
            <h3>A parsed command can be wrong.</h3>
            <p>
              <code>find . -size 100M</code> and <code>find . -size +100M</code>{" "}
              both parse. Only one expresses “larger than 100 MiB” in GNU find.
              Syntax validity cannot resolve that difference.
            </p>
          </article>
          <article>
            <h3>A recognized operation can expose data.</h3>
            <p>
              <code>cat customer-data.txt</code> looks read-only to a static
              allowlist. The validator does not know whether those bytes are
              private or where output will go in your environment.
            </p>
          </article>
          <article>
            <h3>Research labels are not guarantees.</h3>
            <p>
              Corpus risk labels are heuristic. AST overlap is structural
              similarity, not command equivalence. The failure examples here
              illustrate known categories; they are not newly measured model
              outputs.
            </p>
          </article>
          <article>
            <h3>A proposal is not a filesystem preview.</h3>
            <p>
              There is no local-machine connection. Paths, permissions, aliases,
              installed utilities and symbolic links are unknown. Every API
              response records execution as false.
            </p>
          </article>
        </div>
      </section>
      <section className="bench-section bench-sources">
        <span className="mono">04 / OPEN THE NOTEBOOK</span>
        <h2>Evidence you can follow.</h2>
        <a href={`${source}/reports/ShellForge_Review2.md`}>
          Completed experiment report <span>↗</span>
        </a>
        <a href={`${source}/docs/full_data_experiments.md`}>
          Preserved training and evaluation protocol <span>↗</span>
        </a>
        <a href={`${source}/reports/pilot_diagnosis.json`}>
          Historical pilot diagnosis <span>↗</span>
        </a>
        <a href={`${source}/benchmarks/safety_authored.tsv`}>
          Authored static safety examples <span>↗</span>
        </a>
        <Link href="/forge" className="button">
          Use the bounded template workbench ↗
        </Link>
      </section>
    </main>
  );
}
