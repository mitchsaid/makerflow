import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";

export default async function WorkspacePage() {
  const { organisation } = await requireOrganisation();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold" data-testid="business-name">
        {organisation.name}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">You&apos;re all set up</CardTitle>
          <CardDescription className="text-base">
            This is your workspace. Customers and quotes will appear here as we build
            them.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
