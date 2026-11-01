import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { legalContact, LEGAL_UPDATED, SERVICES, type LegalSection } from "@/lib/legal";

/**
 * A page of the privacy policy or the terms (docs/plans/legal-pages.md): public, readable on a phone, with a plain note at
 * the top while the wording has not been checked by a lawyer. The privacy page also lists the outside services.
 */
export function LegalPage({ title, intro, sections, other, withServices = false }: { title: string; intro: string; sections: LegalSection[]; other: { href: string; label: string }; withServices?: boolean }) {
  const contact = legalContact();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-10">
      <div className="space-y-3">
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-2">
          MakerFlow
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-base text-muted-foreground">{intro}</p>
        <p className="text-sm text-muted-foreground">Last changed {LEGAL_UPDATED}.</p>
      </div>
      <Alert role="note" data-testid="legal-draft">
        <AlertDescription>
          This is a plain-language draft that has not yet been checked by a lawyer. It describes what MakerFlow really does today; it may change before launch.
        </AlertDescription>
      </Alert>
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-2" aria-labelledby={`${section.id}-heading`}>
          <h2 id={`${section.id}-heading`} className="text-xl font-semibold">
            {section.heading}
          </h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="text-base">
              {p}
            </p>
          ))}
          {section.list && (
            <ul className="list-disc space-y-1 pl-6 text-base">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {withServices && section.id === "others" && (
            <ul className="space-y-2" aria-label="Services we use">
              {SERVICES.map((s) => (
                <li key={s.name} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <span className="block text-base font-medium">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    For {s.what}. Based in {s.where}.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="space-y-2" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl font-semibold">
          Contact
        </h2>
        <p className="text-base" data-testid="legal-contact">
          {contact ? (
            <>
              Write to <a href={`mailto:${contact}`} className="underline underline-offset-2">{contact}</a>.
            </>
          ) : (
            "The address to write to will be added here before launch. Until then, use Send feedback in the app."
          )}
        </p>
      </section>
      <p className="border-t border-border pt-4 text-sm">
        <Link href={other.href} className="underline underline-offset-2">
          {other.label}
        </Link>
      </p>
    </main>
  );
}
