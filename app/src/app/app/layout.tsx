import { BusinessTypesProvider } from "@/components/business-types-context";
import { requireOrganisation } from "@/lib/auth/dal";
import { PageTransition } from "@/components/page-transition";
import { DemoBanner } from "./demo-banner";
import { WorkspaceNav } from "./nav";

// Building a demo business (sample customers, products, quotes and a logo) takes several seconds; a hosted function is given up to a minute.
export const maxDuration = 60;

export default async function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  const { organisation, profile, demo } = await requireOrganisation();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <WorkspaceNav businessName={organisation.name} />
      {/* Bottom padding (the tab bar's height) keeps content clear of the fixed tab bar on phones. */}
      <div className="flex min-w-0 flex-1 flex-col pb-14 md:pb-0">
        {demo && <DemoBanner kind={demo.kind} expiresAt={demo.expiresAt} />}
        <BusinessTypesProvider types={profile.businessTypes}>
          <PageTransition>{children}</PageTransition>
        </BusinessTypesProvider>
      </div>
    </div>
  );
}
