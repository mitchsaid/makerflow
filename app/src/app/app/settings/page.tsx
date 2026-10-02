import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    pricesIncludeVat: profile.pricesIncludeVat ? "inclusive" : "exclusive",
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      {canEditBusinessProfile(role) ? (
        <BusinessProfileForm initial={initial} countryCode={profile.countryCode} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business details</CardTitle>
            <CardDescription className="text-base">
              Only owners and admins can change these details. You can see them on your
              quotes and invoices.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
