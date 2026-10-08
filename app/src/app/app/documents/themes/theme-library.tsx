"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeThumbnail } from "@/components/theme-thumbnail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { STARTERS, resolveTheme, type SavedTheme, type ThemeSpec } from "@/lib/quotes/themes";
import { deleteTheme } from "../theme-actions";

type Entry = { key: string; name: string; description?: string; spec: ThemeSpec; own: boolean };

/** The starters and the business's own themes as cards: a picture of each, and what can be done with it. */
export function ThemeLibrary({ saved, canEdit }: { saved: readonly SavedTheme[]; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine: Entry[] = saved.map((t) => ({ key: t.id, name: t.name, spec: t.spec, own: true }));
  const starters: Entry[] = STARTERS.map((s) => ({ key: s.key, name: s.name, description: s.description, spec: s.spec, own: false }));

  function run(action: () => Promise<{ status: "saved" } | { status: "error"; message: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "error") setError(result.message);
        else router.refresh();
      } catch {
        setError("Couldn't reach the server, so nothing was changed. Check your connection and try again.");
      }
    });
  }

  const card = (e: Entry) => {
    const from = e.own ? `theme:${e.key}` : `starter:${e.key}`;
    return (
      <li key={e.key} className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10" data-testid="theme-card">
        <div className="flex gap-3">
          <div className="w-24 shrink-0">
            <ThemeThumbnail theme={resolveTheme(e.spec, e.name)} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-base font-medium">
              <span>{e.name}</span>
            </p>
            {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
            {!e.own && <p className="text-sm text-muted-foreground">Starter theme</p>}
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {e.own && (
              <Link href={`/app/documents/themes/${e.key}`} className={buttonVariants({ variant: "outline" })}>
                Edit<span className="sr-only"> {e.name}</span>
              </Link>
            )}
            <Link href={`/app/documents/themes/new?from=${from}`} className={buttonVariants({ variant: "outline" })}>
              Remix<span className="sr-only"> {e.name}</span>
            </Link>
            {e.own && confirming !== e.key && (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(e.key)}>
                Delete<span className="sr-only"> {e.name}</span>
              </Button>
            )}
            {e.own && confirming === e.key && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    setConfirming(null);
                    run(() => deleteTheme(e.key));
                  }}
                >
                  Yes, delete {e.name}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
                  Keep it
                </Button>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <section className="space-y-3" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="text-base font-semibold">
          Your themes
        </h2>
        {mine.length === 0 ? (
          <p className="text-base text-muted-foreground">
            {canEdit
              ? "You haven't made a theme yet. Create one, or remix one of the starters below."
              : "No themes have been made yet. An owner or admin can make them."}
          </p>
        ) : (
          <ul className="space-y-3">{mine.map(card)}</ul>
        )}
      </section>
      <section className="space-y-3" aria-labelledby="starters-heading">
        <h2 id="starters-heading" className="text-base font-semibold">
          Starter themes
        </h2>
        <ul className="space-y-3">{starters.map(card)}</ul>
      </section>
    </div>
  );
}
