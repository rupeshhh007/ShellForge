import { CaseGallery } from "@/components/learning/case-gallery";
export default function Home() {
  return (
    <CaseGallery
      sourceCommit={
        process.env.SHELLFORGE_BUILD_COMMIT ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        "local"
      }
    />
  );
}
