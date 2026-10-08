import { notFound, redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getProducts } from "@/lib/products/data";
import { sampleSnapshot } from "@/lib/quotes/sample";
import { getThemes } from "@/lib/quotes/theme-data";
import { BLANK_SPEC, isStarterKey, starter, themeName } from "@/lib/quotes/themes";
import { ThemeStudio } from "../theme-studio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A new theme in the studio: a copy of a starter or of one of the business's own (`?from=starter:warm`
 * or `?from=theme:<id>`), or a plain start (`?from=blank`). Nothing is saved until Save is pressed.
 */
export default async function NewThemePage({ searchParams }: PageProps<"/app/documents/themes/new">) {
  const query = await searchParams;
  const [workspace, saved, products] = await Promise.all([requireOrganisation(), getThemes(), getProducts()]);
  if (!canEditBusinessProfile(workspace.role)) redirect("/app/documents/themes");

  const from = typeof query.from === "string" ? query.from : "blank";
  let base = { name: "My theme", spec: BLANK_SPEC, basedOn: undefined as string | undefined };
  if (from.startsWith("starter:") && isStarterKey(from.slice(8))) {
    const s = starter(from.slice(8));
    base = { name: themeName(`Remix of ${s.name}`) ?? "My theme", spec: s.spec, basedOn: s.name };
  } else if (from.startsWith("theme:") && UUID.test(from.slice(6))) {
    const t = saved.find((x) => x.id === from.slice(6));
    if (!t) notFound();
    base = { name: themeName(`Remix of ${t.name}`) ?? "My theme", spec: t.spec, basedOn: t.name };
  } else if (from !== "blank") {
    notFound();
  }
  const quoteId = typeof query.quote === "string" && UUID.test(query.quote) ? query.quote : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <ThemeStudio
        snapshot={sampleSnapshot(workspace, products)}
        initial={{ id: null, name: base.name, spec: base.spec }}
        basedOn={base.basedOn}
        quoteId={quoteId}
      />
    </main>
  );
}
