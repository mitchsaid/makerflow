import { requireOrganisation } from "@/lib/auth/dal";
import { signOut } from "./actions";

export default async function WorkspacePage() {
  const { organisation } = await requireOrganisation();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold" data-testid="business-name">
          {organisation.name}
        </h1>
        <form action={signOut}>
          <button type="submit" className="btn-secondary">
            Sign out
          </button>
        </form>
      </header>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">You&apos;re all set up</h2>
        <p className="text-muted">
          This is your workspace. Customers, invoices and quotes will appear here as
          we build them.
        </p>
      </section>
    </main>
  );
}
