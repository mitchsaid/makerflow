import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getThemes } from "@/lib/quotes/theme-data";
import { ThemeLibrary } from "./theme-library";

/**
 * Quotes and invoices > Themes: the looks a business can put on its quotes. Five starters that ship
 * with the app, and the business's own. Use one, remix one into your own, or start from scratch.
 */
export default async function ThemesPage() {
  const [{ role }, saved] = await Promise.all([requireOrganisation(), getThemes()]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/documents" className="text-sm text-muted-foreground underline">
          Quotes and invoices
        </Link>
        <h1 className="text-xl font-semibold">Themes</h1>
        <p className="text-base text-muted-foreground">
          How your quotes look. A new quote starts with the theme you chose last, and each quote can pick another.
          Quotes you have already sent keep the look they were sent in.
        </p>
      </div>
      {canEditBusinessProfile(role) && (
        <Link href="/app/documents/themes/new" className={buttonVariants({ size: "lg" })}>
          Create new theme
        </Link>
      )}
      <ThemeLibrary saved={saved} canEdit={canEditBusinessProfile(role)} />
    </main>
  );
}
