import type { Metadata } from "next";
import { Workbench } from "@/components/workbench";
export const metadata: Metadata = { title: "Command X-Ray" };
export default async function XRay({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const command =
    typeof query.command === "string" ? query.command.slice(0, 4000) : "";
  return <Workbench key={command} mode="xray" initialRequest={command} />;
}
