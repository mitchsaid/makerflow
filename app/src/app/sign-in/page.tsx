import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";
import { SignInForm } from "./sign-in-form";
import { signInWithGoogle } from "./actions";

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one below.",
  oauth: "We couldn't sign you in with Google. Please try again, or use email.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getUser()) redirect("/app");

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? ERRORS[error] : undefined;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "true";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Sign in or create an account</h1>
        <p className="text-muted">
          New here? Enter your email and we&apos;ll set you up.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="card border-danger text-danger">
          {errorMessage}
        </p>
      )}

      <SignInForm />

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <form action={signInWithGoogle}>
            <button type="submit" className="btn-secondary w-full">
              Continue with Google
            </button>
          </form>
        </>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/" className="underline">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
