import { notFound, redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getProducts } from "@/lib/products/data";
import { sampleSnapshot } from "@/lib/quotes/sample";
import { getThemes } from "@/lib/quotes/theme-data";
import { ThemeStudio } from "../theme-studio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the business's own themes in the studio. */
export default async function EditThemePage({ params, searchParams }: PageProps<"/app/documents/themes/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [workspace, saved, products] = await Promise.all([requireOrganisation(), getThemes(), getProducts()]);
  if (!canEditBusinessProfile(workspace.role)) redirect("/app/documents/themes");
  const theme = saved.find((t) => t.id === id);
  if (!theme) notFound();
  const quoteId = typeof query.quote === "string" && UUID.test(query.quote) ? query.quote : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <ThemeStudio snapshot={sampleSnapshot(workspace, products)} initial={{ id: theme.id, name: theme.name, spec: theme.spec }} quoteId={quoteId} />
    </main>
  );
}
