import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { getLocalePack } from "@/lib/locale";
import { forOrganisation } from "@/lib/scope";
import { customerOptions } from "../../quotes/builder-data";
import { NewJobForm } from "./new-job-form";

export default async function NewJobPage() {
  // The customers load beside the workspace check, not after it.
  const [allCustomers, { organisation, profile }] = await Promise.all([getCustomersWithAddresses(), requireOrganisation()]);
  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/jobs" className="text-sm text-muted-foreground underline">
          Jobs
        </Link>
        <h1 className="text-xl font-semibold">New job</h1>
        <p className="text-sm text-muted-foreground">
          For work that did not start with a quote: a walk-in order, a repeat, something agreed over WhatsApp.
        </p>
      </div>
      <NewJobForm customers={customerOptions(customers, locale)} countryCode={profile.countryCode} />
    </main>
  );
}
