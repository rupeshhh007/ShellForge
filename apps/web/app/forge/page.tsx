import type { Metadata } from "next";
import { Workbench } from "@/components/workbench";
export const metadata: Metadata = { title: "The Forge" };

export default async function Forge({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const recipe =
    typeof query.recipe === "string" ? query.recipe.slice(0, 50) : undefined;
  const parameters: Record<string, string> = {};
  for (const key of ["path", "size", "pattern", "count"])
    if (typeof query[key] === "string")
      parameters[key] = query[key].slice(0, 240);
  const request = recipe
    ? `Use the ${recipe} recipe with the explicit parameters below`
    : query.example === "large-files"
      ? "Find files larger than 100 MiB in the current directory"
      : "";
  return (
    <Workbench
      key={`${recipe}-${JSON.stringify(parameters)}`}
      mode="forge"
      initialRequest={request}
      initialRecipe={recipe}
      initialParameters={parameters}
    />
  );
}
