import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/dal";
import { SignInForm } from "./sign-in-form";
import { signInWithGoogle } from "./actions";

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one below.",
  oauth: "We couldn't sign you in with Google. Please try again, or use email.",
  callback:
    "That sign-in didn't work. Open the link in the same browser you asked from, or request a new one below.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getUser()) redirect("/app");

  const { error, account } = await searchParams;
  const errorMessage = typeof error === "string" ? ERRORS[error] : undefined;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "true";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Sign in or create an account</h1>
        <p className="text-muted-foreground">
          New here? Enter your email and we&apos;ll set you up.
        </p>
      </div>

      {account === "deleted" && (
        <Alert role="status" data-testid="account-deleted">
          <AlertDescription>Your account has been deleted. You can create a new one below.</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <SignInForm />

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="underline">
          Back to the home page
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2">
          terms
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </main>
  );
}
