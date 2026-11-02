import { ImportCard } from "@/components/import-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { currencySymbol, moneyToInput, percentToInput } from "@/lib/money";
import { PricingForm } from "./pricing-form";

/**
 * Product settings: how prices are worked out (your hourly rate and the margin you aim for), and bringing in a list of
 * products or services you already have. They live with the products, where they are used, not in the Business
 * profile, which holds facts about the business.
 */
export default async function ProductSettingsPage() {
  const { profile, role } = await requireOrganisation();
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/products", label: "Products" }}>
        <h1 className="text-2xl font-semibold">Product settings</h1>
      </PageHeader>
      <ImportCard title="Import" line="Bring in products or services from a spreadsheet or file." href="/app/products/import" label="Import a list" />
      {canEditBusinessProfile(role) ? (
        <PricingForm
          initial={{
            labourRate: profile.labourRateCents === null ? "" : moneyToInput(profile.labourRateCents, locale.numberStyle),
            targetMargin: profile.targetMarginBp === null ? "" : percentToInput(profile.targetMarginBp, locale.numberStyle),
          }}
          currencySymbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pricing</CardTitle>
            <CardDescription className="text-base">Only owners and admins can change these.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
