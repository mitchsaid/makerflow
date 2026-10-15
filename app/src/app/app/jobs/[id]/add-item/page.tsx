import { notFound } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { jobNumberText, MAX_JOB_ITEMS, takesNewItems } from "@/lib/jobs";
import { getJob } from "@/lib/jobs/data";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { AddJobItemForm } from "./add-item-form";
import { PageHeader } from "@/components/page-header";

export default async function AddJobItemPage({ params }: PageProps<"/app/jobs/[id]/add-item">) {
  const { id } = await params;
  // The job and the products load beside the workspace check, not after it.
  const [job, allProducts, { organisation, profile }] = await Promise.all([getJob(id), getProducts(), requireOrganisation()]);
  if (job.organisationId !== organisation.id) notFound();
  const locale = getLocalePack(profile.countryCode);
  const number = jobNumberText(job.number);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: `/app/jobs/${job.id}`, label: `Job ${number}` }}>
        <h1 className="text-xl font-semibold">Add an item to job {number}</h1>
        <p className="text-sm text-muted-foreground">
          For {job.customerName}. The new item joins what is to be made
          {job.quoteId ? "; the quote it came from stays as it was" : ""}.
        </p>
      </PageHeader>
      {!takesNewItems(job.status) ? (
        <p className="text-base">This job has moved on, so it can&rsquo;t take new items now.</p>
      ) : job.fullItems.length >= MAX_JOB_ITEMS ? (
        <p className="text-base">A job can have up to {MAX_JOB_ITEMS} items.</p>
      ) : (
        <AddJobItemForm
          jobId={job.id}
          products={forOrganisation(allProducts, organisation.id)}
          numberStyle={locale.numberStyle}
          currencyCode={profile.currencyCode}
          vat={vatSettingsFor(profile, locale)}
          taxName={locale.tax.name}
          vatStatuses={locale.tax.statuses}
          businessTypes={profile.businessTypes}
        />
      )}
    </main>
  );
}
