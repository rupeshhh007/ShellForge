import { LessonExperience } from "@/components/learning/lesson-experience";
export const metadata = { title: "Beat the Model — Saved Evaluation" };
export default function Beat() {
  return (
    <main id="main" className="arl-direct page-shell">
      <LessonExperience
        sourceCommit={
          process.env.SHELLFORGE_BUILD_COMMIT ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          "local"
        }
        id="beat-model"
      />
    </main>
  );
}
