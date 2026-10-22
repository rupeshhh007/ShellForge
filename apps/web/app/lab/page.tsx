import type { Metadata } from "next";
import { LabWorlds } from "@/components/lab-worlds";
import { ImpactLab } from "@/components/impact-lab";
export const metadata: Metadata = { title: "Command Impact Lab" };
export default async function Lab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const command =
    typeof query.command === "string"
      ? query.command.slice(0, 2001)
      : undefined;
  return (
    <>
      <LabWorlds />
      <div id="filesystem">
        <ImpactLab key={command ?? "session"} initialCommand={command} />
      </div>
    </>
  );
}
