import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { signOut } from "../actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

/**
 * Settings is for the person and the app: who is signed in and how the app behaves
 * for them. Facts about the business live in the Business profile.
 */
export default async function SettingsPage() {
  const { user, role } = await requireOrganisation();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your account</CardTitle>
          <CardDescription className="text-base">
            {user.email ? (
              <>
                Signed in as <span data-testid="account-email">{user.email}</span>
              </>
            ) : (
              "You are signed in."
            )}
            {" · "}
            <span data-testid="account-role">{ROLE_LABELS[role] ?? role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">App preferences</CardTitle>
          <CardDescription className="text-base">
            Preferences for how the app looks and behaves for you will appear here. Details
            about your business are in the Business profile.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
