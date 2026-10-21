import type { Metadata } from "next";
import { Workbench } from "@/components/workbench";
export const metadata: Metadata = { title: "Command X-Ray" };
export default function XRay() {
  return <Workbench mode="xray" />;
}
