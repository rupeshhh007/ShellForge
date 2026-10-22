// Mirrors services/api/schemas.py. Runtime receipts are validated before display.
export type Profile = "linux" | "macos";
export type Token = {
  text: string;
  start: number;
  end: number;
  role: string;
  explanation: string;
  implication: string;
  constraint: string | null;
  supported: boolean;
};
export type Intent = {
  operation: string;
  target: string;
  conditions: string[];
  threshold: number | null;
  units: string | null;
  exclusions: string[];
  platform: Profile;
  scope: string;
  expected_side_effects: string;
  missing_information: string[];
};
export type Receipt = {
  status: "proposed" | "analyzed" | "unsupported" | "needs_clarification";
  request: string;
  profile: Profile;
  command: string | null;
  backend: string;
  message: string;
  intent: Intent | null;
  safety: {
    risk: "SAFE" | "CAUTION" | "DANGEROUS";
    syntax_valid: boolean;
    reasons: string[];
    policy: string;
  } | null;
  tokens: Token[];
  assumptions: string[];
  clarification: string | null;
  executed: false;
  requires_manual_review: true;
  limitations: string[];
};
export type Recipe = {
  id: string;
  title: string;
  category: string;
  description: string;
  request: string;
  command: string;
  profiles: Profile[];
  compatibility: string;
  parameters: { name: string; label: string; default: string }[];
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
export function isReceipt(v: unknown): v is Receipt {
  if (
    !object(v) ||
    !["proposed", "analyzed", "unsupported", "needs_clarification"].includes(
      String(v.status),
    ) ||
    typeof v.request !== "string" ||
    !["linux", "macos"].includes(String(v.profile)) ||
    typeof v.backend !== "string" ||
    typeof v.message !== "string" ||
    !(v.command === null || typeof v.command === "string") ||
    !(v.clarification === null || typeof v.clarification === "string") ||
    v.executed !== false ||
    v.requires_manual_review !== true ||
    !strings(v.assumptions) ||
    !strings(v.limitations) ||
    !Array.isArray(v.tokens)
  )
    return false;
  if (
    v.safety !== null &&
    (!object(v.safety) ||
      typeof v.safety.syntax_valid !== "boolean" ||
      !["SAFE", "CAUTION", "DANGEROUS"].includes(String(v.safety.risk)) ||
      !strings(v.safety.reasons) ||
      typeof v.safety.policy !== "string")
  )
    return false;
  if (
    v.intent !== null &&
    (!object(v.intent) ||
      typeof v.intent.operation !== "string" ||
      typeof v.intent.target !== "string" ||
      typeof v.intent.scope !== "string" ||
      !strings(v.intent.conditions) ||
      !strings(v.intent.exclusions) ||
      !strings(v.intent.missing_information) ||
      typeof v.intent.expected_side_effects !== "string")
  )
    return false;
  let previousEnd = 0;
  for (const t of v.tokens) {
    if (
      !object(t) ||
      typeof t.text !== "string" ||
      typeof t.role !== "string" ||
      typeof t.explanation !== "string" ||
      typeof t.implication !== "string" ||
      typeof t.supported !== "boolean" ||
      !Number.isInteger(t.start) ||
      !Number.isInteger(t.end) ||
      (t.start as number) < previousEnd ||
      (t.end as number) < (t.start as number) ||
      typeof v.command !== "string" ||
      Array.from(v.command)
        .slice(t.start as number, t.end as number)
        .join("") !== t.text
    )
      return false;
    previousEnd = t.end as number;
  }
  return true;
}
export function isRecipes(value: unknown): value is Recipe[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        object(v) &&
        [
          "id",
          "title",
          "category",
          "description",
          "request",
          "command",
          "compatibility",
        ].every((k) => typeof v[k] === "string") &&
        strings(v.profiles) &&
        v.profiles.every((p) => ["linux", "macos"].includes(p)) &&
        Array.isArray(v.parameters) &&
        v.parameters.every(
          (p) =>
            object(p) &&
            ["name", "label", "default"].every((k) => typeof p[k] === "string"),
        ),
    )
  );
}

export async function readApi(
  path: string,
  options?: RequestInit,
): Promise<unknown> {
  const response = await fetch(path, {
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 429)
      throw new Error(
        "The workshop is busy. Request limit reached; try again in a minute.",
      );
    if (response.status === 422)
      throw new Error(
        "Check the input length, profile and parameters. This request could not be validated.",
      );
    if (response.status === 413)
      throw new Error("This request is too large. Shorten it and try again.");
    throw new Error(
      "The API could not complete the request. Check the backend connection and try again.",
    );
  }
  return response.json();
}
