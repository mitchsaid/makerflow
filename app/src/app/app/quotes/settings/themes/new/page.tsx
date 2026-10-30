import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ThemeThumbnail } from "@/components/theme-thumbnail";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getProducts } from "@/lib/products/data";
import { sampleSnapshot } from "@/lib/quotes/sample";
import { getThemes } from "@/lib/quotes/theme-data";
import { themeTargetBack, themeTargetFromQuery, themeTargetParam } from "@/lib/quotes/theme-target";
import { BLANK_SPEC, STARTERS, isStarterKey, resolveTheme, starter, themeName } from "@/lib/quotes/themes";
import { ThemeStudio } from "../theme-studio";
import { PageHeader } from "@/components/page-header";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Creating a theme. First, how to start: a blank page, a copy of a starter, or a copy of one of your
 * own (shown as pictures). Then the studio (`?from=starter:warm`, `?from=theme:<id>` or `?from=blank`),
 * where nothing is saved until Save is pressed. `?quote=<id>` or `?invoice=<id>` carries on from a draft's preview.
 */
export default async function NewThemePage({ searchParams }: PageProps<"/app/quotes/settings/themes/new">) {
  const query = await searchParams;
  // The products are only needed to draw the studio's sample quote, not to choose where to start.
  const [workspace, saved, products] = await Promise.all([requireOrganisation(), getThemes(), typeof query.from === "string" ? getProducts() : Promise.resolve([])]);
  if (!canEditBusinessProfile(workspace.role)) redirect("/app/quotes/settings/themes");

  const target = themeTargetFromQuery(query);
  const quoteParam = target ? `&${themeTargetParam(target)}` : "";
  if (typeof query.from !== "string") {
    // Step one: how to start.
    const back = target ? themeTargetBack(target) : { href: "/app/quotes/settings/themes", label: "Themes" };
    const card = (href: string, name: string, theme: ReturnType<typeof resolveTheme>, note?: string) => (
      <li key={href}>
        <Link
          href={href}
          className="flex h-full flex-col gap-2 rounded-xl bg-card p-2 text-center ring-1 ring-foreground/15 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ThemeThumbnail theme={theme} />
          <span className="px-1 pb-1 text-base font-medium">{name}</span>
          {note && <span className="px-1 pb-1 text-sm text-muted-foreground">{note}</span>}
        </Link>
      </li>
    );
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <PageHeader back={{ href: back.href, label: back.label }}>
          <h1 className="text-xl font-semibold">Create a new theme</h1>
          <p className="text-base text-muted-foreground">How do you want to start? You can change everything afterwards.</p>
        </PageHeader>
        <section className="space-y-3" aria-labelledby="blank-heading">
          <h2 id="blank-heading" className="text-base font-semibold">
            From a blank page
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{card(`/app/quotes/settings/themes/new?from=blank${quoteParam}`, "Start from scratch", resolveTheme(BLANK_SPEC, "New"), "Plain black and white")}</ul>
        </section>
        <section className="space-y-3" aria-labelledby="starter-heading">
          <h2 id="starter-heading" className="text-base font-semibold">
            Remix a starter
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STARTERS.map((s) => card(`/app/quotes/settings/themes/new?from=starter:${s.key}${quoteParam}`, s.name, resolveTheme(s.spec, s.name), s.description))}
          </ul>
        </section>
        {saved.length > 0 && (
          <section className="space-y-3" aria-labelledby="mine-heading">
            <h2 id="mine-heading" className="text-base font-semibold">
              Remix one of yours
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {saved.map((t) => card(`/app/quotes/settings/themes/new?from=theme:${t.id}${quoteParam}`, t.name, resolveTheme(t.spec, t.name)))}
            </ul>
          </section>
        )}
      </main>
    );
  }
  const from = query.from;
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

  return (
    <main className="flex flex-1 flex-col">
      <ThemeStudio
        snapshot={sampleSnapshot(workspace, products)}
        initial={{ id: null, name: base.name, spec: base.spec }}
        basedOn={base.basedOn}
        target={target}
      />
    </main>
  );
}
