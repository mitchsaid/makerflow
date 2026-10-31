import { PageHeader } from "@/components/page-header";
import { SectionTabs, type SectionLink } from "@/components/section-switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { backLabelFor, safeBackPath, withBack } from "@/lib/back-link";
import { bankLines, bankSummary } from "@/lib/bank";
import { canEditPaymentMethods, paymentMethodLines, paymentMethodSummary } from "@/lib/payments";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { formatMoment } from "@/lib/quotes/dates";
import { bankFormValues } from "@/lib/bank/form";
import { WaysToPay } from "./ways-to-pay";
import { LogoForm } from "./logo-form";
import Link from "@/components/app-link";
import { buttonVariants } from "@/components/ui/button";
import { readerEnabled } from "@/lib/reader";
import { BusinessProfileForm } from "./business-profile-form";
import { businessFormValues } from "./form-values";

const SECTIONS = ["details", "logo", "pay"] as const;
type Section = (typeof SECTIONS)[number];
const ITEMS: SectionLink<Section>[] = [
  { key: "details", label: "Details", href: "/app/business" },
  { key: "logo", label: "Logo", href: "/app/business?section=logo" },
  { key: "pay", label: "Ways to pay", href: "/app/business?section=pay" },
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
 * The Business profile: facts about the business, in three tabs (Details, Logo, Ways to pay), each with one Save
 * (docs/plans/ux-pass-2.md, E). How documents are numbered and worded lives with them (Quotes, Invoices); the hourly
 * rate and target margin with the products.
 */
export default async function BusinessProfilePage({ searchParams }: PageProps<"/app/business">) {
  const [{ organisation, profile, role, bankDetails, paymentMethods }, query] = await Promise.all([requireOrganisation(), searchParams]);
  // "bank" is the tab's old name: a bookmark to it still opens Ways to pay.
  const asked = typeof query.section === "string" ? query.section : "details";
  const wanted = asked === "bank" ? "pay" : asked;
  const section: Section = (SECTIONS as readonly string[]).includes(wanted) ? (wanted as Section) : "details";
  const canEdit = canEditBusinessProfile(role);
  // Sent here from a document to fix something: the way back to it stays with the page (and its tabs).
  const back = safeBackPath(query.back);
  const items = back ? ITEMS.map((item) => ({ ...item, href: withBack(item.href, back) })) : ITEMS;

  const locale = getLocalePack(profile.countryCode);
  const initial = businessFormValues(organisation.name, profile);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      {back ? (
        <PageHeader back={{ href: back, label: backLabelFor(back) }}>
          <h1 className="text-xl font-semibold">Business profile</h1>
        </PageHeader>
      ) : (
        <h1 className="text-xl font-semibold">Business profile</h1>
      )}

      <SectionTabs
        label="Business profile"
        items={items}
        initial={section}
        panels={{
          details: canEdit ? (
            <div className="space-y-6">
              {readerEnabled() && (
                <Link href="/onboarding/start?from=business" className={buttonVariants({ variant: "outline" })} data-testid="fill-from-document">
                  Fill in from a quote or invoice
                </Link>
              )}
              <BusinessProfileForm initial={initial} countryCode={profile.countryCode} />
            </div>
          ) : (
            <OnlyOwners title="Business details">Only owners and admins can change these.</OnlyOwners>
          ),
          logo: canEdit ? (
            <LogoForm initial={profile.logoImageId ?? ""} businessName={organisation.name} />
          ) : (
            <OnlyOwners title="Your logo">Only owners and admins can change the logo.</OnlyOwners>
          ),
          pay: canEditPaymentMethods(role) ? (
            <WaysToPay
              countryCode={profile.countryCode}
              bankInitial={bankFormValues(bankDetails, profile.countryCode)}
              bankLastChanged={bankDetails ? formatMoment(bankDetails.updatedAt, locale.formatLocale, locale.timeZone) : null}
              initialMethods={paymentMethods}
            />
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{locale.payment.bankTransferName}</CardTitle>
                  <CardDescription className="text-base">
                    {bankDetails ? `${bankSummary(bankDetails, locale)}. ` : "No bank account yet. "}
                    Only the owner can change the ways to pay.
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
              {paymentMethods.map((method) => (
                <Card key={method.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{method.name}</CardTitle>
                    <CardDescription className="text-base">{paymentMethodSummary(method, locale)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
                      {paymentMethodLines(method, locale).map((line) => (
                        <div key={line.label} className="contents">
                          <dt className="text-muted-foreground">{line.label}</dt>
                          <dd>{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>
          ),
        }}
      />
    </main>
  );
}
