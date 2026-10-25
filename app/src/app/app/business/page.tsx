import { SectionTabs, type SectionLink } from "@/components/section-switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { bankLines, bankSummary, canEditBankDetails } from "@/lib/bank";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { formatMoment } from "@/lib/quotes/dates";
import { bankFormValues } from "@/lib/bank/form";
import { BankDetailsForm } from "./bank-details-form";
import { LogoForm } from "./logo-form";
import { BusinessProfileForm, type FormValues } from "./business-profile-form";

const SECTIONS = ["details", "logo", "bank"] as const;
type Section = (typeof SECTIONS)[number];
const ITEMS: SectionLink<Section>[] = [
  { key: "details", label: "Details", href: "/app/business" },
  { key: "logo", label: "Logo", href: "/app/business?section=logo" },
  { key: "bank", label: "Bank details", href: "/app/business?section=bank" },
];

/** Only owners and admins change the business's facts: anyone else is told so, in the tab they opened. */
function OnlyOwners({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-base">{children}</CardDescription>
      </CardHeader>
    </Card>
  );
}

/**
 * The Business profile: facts about the business, in three tabs (Details, Logo, Bank details), each with one Save
 * (docs/plans/ux-pass-2.md, E). How documents are numbered and worded lives with them (Quotes, Invoices); the hourly
 * rate and target margin with the products.
 */
export default async function BusinessProfilePage({ searchParams }: PageProps<"/app/business">) {
  const [{ organisation, profile, role, bankDetails }, query] = await Promise.all([requireOrganisation(), searchParams]);
  const wanted = typeof query.section === "string" ? query.section : "details";
  const section: Section = (SECTIONS as readonly string[]).includes(wanted) ? (wanted as Section) : "details";
  const canEdit = canEditBusinessProfile(role);

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
    businessTypes: [...(profile.businessTypes ?? [])],
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Business profile</h1>

      <SectionTabs
        label="Business profile"
        items={ITEMS}
        initial={section}
        panels={{
          details: canEdit ? (
            <BusinessProfileForm initial={initial} countryCode={profile.countryCode} />
          ) : (
            <OnlyOwners title="Business details">Only owners and admins can change these.</OnlyOwners>
          ),
          logo: canEdit ? (
            <LogoForm initial={profile.logoImageId ?? ""} businessName={organisation.name} />
          ) : (
            <OnlyOwners title="Your logo">Only owners and admins can change the logo.</OnlyOwners>
          ),
          bank: canEditBankDetails(role) ? (
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
                    ? `${bankSummary(bankDetails, locale)}. Shown on your quotes. `
                    : "No bank details yet. "}
                  Only the owner can change them.
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
          ),
        }}
      />
    </main>
  );
}
