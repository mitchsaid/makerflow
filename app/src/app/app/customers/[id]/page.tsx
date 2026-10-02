import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomer } from "@/lib/customers/data";
import { updateCustomer } from "../actions";
import { CustomerForm } from "../customer-form";
import { valuesFromCustomer } from "../customer-values";
import { ArchiveButton } from "./archive-button";

export default async function CustomerPage({ params }: PageProps<"/app/customers/[id]">) {
  const { id } = await params;
  // The customer query runs beside the workspace check, not after it.
  const [customer, { organisation, profile }] = await Promise.all([
    getCustomer(id),
    requireOrganisation(),
  ]);
  // Another business of the same person is not this workspace's customer.
  if (customer.organisationId !== organisation.id) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/customers" className="text-sm text-muted-foreground underline">
          Customers
        </Link>
        <h1 className="text-xl font-semibold">{customer.name}</h1>
      </div>

      {customer.archived && (
        <Alert data-testid="archived-notice">
          <AlertDescription>
            This customer is archived, so it is hidden from your list. Restore it below to use it
            again.
          </AlertDescription>
        </Alert>
      )}

      <CustomerForm
        key={customer.id}
        mode="edit"
        action={updateCustomer.bind(null, customer.id)}
        initial={valuesFromCustomer(customer)}
        countryCode={profile.countryCode}
      />

      <ArchiveButton id={customer.id} archived={customer.archived} />
    </main>
  );
}
