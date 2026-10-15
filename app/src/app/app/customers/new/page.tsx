import { requireOrganisation } from "@/lib/auth/dal";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";
import { EMPTY_CUSTOMER } from "../customer-values";
import { PageHeader } from "@/components/page-header";

export default async function NewCustomerPage() {
  const { profile } = await requireOrganisation();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/customers", label: "Customers" }}>
        <h1 className="text-xl font-semibold">Add a customer</h1>
        <p className="text-muted-foreground">Only a name is needed. You can add the rest later.</p>
      </PageHeader>
      <CustomerForm
        mode="add"
        action={createCustomer}
        initial={EMPTY_CUSTOMER}
        countryCode={profile.countryCode}
      />
    </main>
  );
}
