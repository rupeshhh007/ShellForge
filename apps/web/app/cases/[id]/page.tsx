import { notFound } from "next/navigation";
import { CASES } from "@/lib/learning/cases";
import { LessonExperience } from "@/components/learning/lesson-experience";
export function generateStaticParams() {
  return CASES.map(({ id }) => ({ id }));
}
export const dynamicParams = false;
export default async function Case({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!CASES.some((c) => c.id === id)) notFound();
  return (
    <main id="main" className="arl-direct page-shell">
      <LessonExperience
        sourceCommit={
          process.env.SHELLFORGE_BUILD_COMMIT ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          "local"
        }
        id={id}
      />
    </main>
  );
}
