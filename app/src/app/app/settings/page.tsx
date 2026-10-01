import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { signOut } from "../actions";
import { BusinessProfileForm, type FormValues } from "./business-profile-form";

export default async function SettingsPage() {
  const { organisation, profile, role } = await requireOrganisation();

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
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      {canEditBusinessProfile(role) ? (
        <BusinessProfileForm initial={initial} />
      ) : (
        <section className="card space-y-2">
          <h2 className="text-lg font-semibold">Business details</h2>
          <p className="text-muted">
            Only owners and admins can change these details. You can see them on your
            quotes and invoices.
          </p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Your account</h2>
        <form action={signOut}>
          <button type="submit" className="btn-secondary">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
