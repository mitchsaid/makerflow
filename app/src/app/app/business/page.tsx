import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { bankLines, bankSummary, canEditBankDetails } from "@/lib/bank";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { formatMoment } from "@/lib/quotes/dates";
import { bankFormValues } from "@/lib/bank/form";
import { BankDetailsForm } from "./bank-details-form";
import { BusinessTypesForm } from "./business-types-form";
import { BusinessProfileForm, type FormValues } from "./business-profile-form";

export default async function BusinessProfilePage() {
  const { organisation, profile, role, bankDetails } = await requireOrganisation();

  const locale = getLocalePack(profile.countryCode);
  const initial: FormValues = {
    name: organisation.name,
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    region: profile.region ?? "",
    postalCode: profile.postalCode ?? "",
    vatRegistered: profile.vatRegistered,
    vatNumber: profile.vatNumber ?? "",
    pricesIncludeVat: profile.pricesIncludeVat ? "inclusive" : "exclusive",
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Business profile</h1>

      {canEditBusinessProfile(role) ? (
        <BusinessProfileForm initial={initial} countryCode={profile.countryCode} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business details</CardTitle>
            <CardDescription className="text-base">
              Only owners and admins can change these details. You can see them on your
              quotes and invoices.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEditBusinessProfile(role) && <BusinessTypesForm initial={[...(profile.businessTypes ?? [])]} />}

      {canEditBankDetails(role) ? (
        <BankDetailsForm
          initial={bankFormValues(bankDetails, profile.countryCode)}
          countryCode={profile.countryCode}
          lastChanged={bankDetails ? formatMoment(bankDetails.updatedAt, locale.formatLocale, locale.timeZone) : null}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bank details</CardTitle>
            <CardDescription className="text-base">
              {bankDetails
                ? `${bankSummary(bankDetails, locale)}. They are shown on your quotes. `
                : "No bank details are saved yet. "}
              Only the owner can change them, because they decide where customers send money.
            </CardDescription>
          </CardHeader>
          {bankDetails && (
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
                {bankLines(bankDetails, null, locale).map((line) => (
                  <div key={line.label} className="contents">
                    <dt className="text-muted-foreground">{line.label}</dt>
                    <dd>{line.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quotes and invoices</CardTitle>
          <CardDescription className="text-base">
            How your quotes are numbered and worded, your policies and what new quotes start with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/documents" className={buttonVariants({ variant: "outline" })}>
            Quote and invoice settings
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
