// Prerendered at build time; the deploy command supplies the tested Git revision.
export const dynamic = "force-static";
export function GET() {
  return Response.json({
    product: "ShellForge",
    feature: "almost-right-lab-v1",
    commit:
      process.env.SHELLFORGE_BUILD_COMMIT ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      "local",
    simulation: "synthetic-memory-only",
    model_status_endpoint: "/api/model/status",
    model_weights_bundled: false,
  });
}
