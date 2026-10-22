"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isRecipes, readApi, type Recipe } from "@/lib/contracts";

function RecipeRow({ recipe, index }: { recipe: Recipe; index: number }) {
  const [parameters, setParameters] = useState<Record<string, string>>(() =>
    Object.fromEntries(recipe.parameters.map((p) => [p.name, p.default])),
  );
  const query = new URLSearchParams({ recipe: recipe.id, ...parameters });
  return (
    <details className="recipe-row">
      <summary>
        <span className="recipe-index mono">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h2>{recipe.title}</h2>
          <span className="mono">{recipe.category}</span>
        </div>
        <code>{recipe.command}</code>
        <span className="recipe-toggle" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="recipe-expanded">
        <div>
          <p>{recipe.description}</p>
          <p className="recipe-compatibility">{recipe.compatibility}</p>
          <p className="mono recipe-request">
            Language grammar example:
            <br />
            {recipe.request}
          </p>
        </div>
        <div>
          <div className="recipe-parameters">
            {recipe.parameters.map((p) => (
              <label key={p.name}>
                {p.label}
                <input
                  maxLength={240}
                  value={parameters[p.name]}
                  onChange={(e) =>
                    setParameters((current) => ({
                      ...current,
                      [p.name]: e.target.value,
                    }))
                  }
                  spellCheck={false}
                />
              </label>
            ))}
          </div>
          <Link href={`/forge?${query.toString()}`} className="button">
            Open in the Forge <span aria-hidden="true">↗</span>
          </Link>
          <p className="parameter-help">
            Parameters are validated by the API before a proposal is produced.
          </p>
        </div>
      </div>
    </details>
  );
}

export function FieldManual() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All operations");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    readApi("/api/recipes", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then((result) => {
        if (!isRecipes(result))
          throw new Error(
            "The recipe catalog did not match its expected contract.",
          );
        setRecipes(result);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load recipes.");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [retry]);
  const categories = [
    "All operations",
    ...new Set(recipes.map((r) => r.category)),
  ];
  const visible = recipes.filter(
    (r) =>
      (category === "All operations" || category === r.category) &&
      `${r.title} ${r.description} ${r.command} ${r.category}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  return (
    <main id="main" className="page-shell manual-page">
      <div className="manual-heading">
        <div>
          <span className="section-number mono">
            The Field Manual / A working collection
          </span>
          <h1>
            Good operations.
            <br />
            <em>Close at hand.</em>
          </h1>
        </div>
        <div className="manual-aside">
          <span aria-hidden="true" className="manual-glyph">
            {"{ }"}
          </span>
          <p>
            Useful shell recipes, with the details left in. Read, adapt,
            inspect.
          </p>
        </div>
      </div>
      <div className="manual-toolbar">
        <label className="manual-search">
          <span className="mono">SEARCH THE MANUAL</span>
          <input
            type="search"
            placeholder="A filename, a utility, an intention…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="manual-category">
          <span className="mono">BROWSE BY OPERATION</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <span className="manual-count mono" aria-live="polite">
          {loading
            ? "Loading…"
            : `${visible.length} / ${recipes.length} operations`}
        </span>
      </div>
      {error ? (
        <div className="api-error" role="alert">
          <h2>The manual is out of reach.</h2>
          <p>{error}</p>
          <button
            className="button"
            onClick={() => {
              setLoading(true);
              setRetry((v) => v + 1);
            }}
          >
            Reload the catalog ↗
          </button>
        </div>
      ) : loading ? (
        <p className="manual-loading" role="status">
          Loading the actual API recipe catalog…
        </p>
      ) : visible.length ? (
        <div className="recipe-list">
          {visible.map((r, i) => (
            <RecipeRow
              recipe={r}
              index={recipes.indexOf(r)}
              key={`${r.id}-${i}`}
            />
          ))}
        </div>
      ) : (
        <div className="manual-no-results">
          <h2>No operation matches yet.</h2>
          <p>Try “find”, “disk”, “text”, or clear your filters.</p>
          <button
            className="text-link"
            onClick={() => {
              setSearch("");
              setCategory("All operations");
            }}
          >
            Reset filters ↗
          </button>
        </div>
      )}
      <div className="manual-note">
        <span className="mono">A MANUAL, NOT A MANDATE</span>
        <p>
          These are narrowly supported templates, not universal shell recipes.
          Profiles name the intended utilities; installed versions and
          permissions remain your responsibility. Nothing is executed or tested
          against your filesystem.
        </p>
        <Link href="/xray" className="text-link">
          Inspect another command in X-Ray ↗
        </Link>
      </div>
    </main>
  );
}
