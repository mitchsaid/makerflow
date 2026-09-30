import { requireOrganisation } from "@/lib/auth/dal";
import { WorkspaceNav } from "./nav";

export default async function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  const { organisation } = await requireOrganisation();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <WorkspaceNav businessName={organisation.name} />
      {/* Bottom padding keeps content clear of the fixed tab bar on phones. */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">{children}</div>
    </div>
  );
}
