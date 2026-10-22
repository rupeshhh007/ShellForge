import type { Metadata } from "next";
import { FieldManual } from "@/components/field-manual";
export const metadata: Metadata = { title: "The Field Manual" };
export default function Manual() {
  return <FieldManual />;
}
