import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-12 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Quotes, jobs and invoices for people who make things
        </h1>
        <p className="text-lg text-muted">
          Send a beautiful quote, track the job, invoice for the work, and see your
          margin on every order.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/sign-in" className="btn-primary">
          Get started
        </Link>
        <span className="btn-secondary cursor-not-allowed opacity-60" aria-disabled="true">
          Try the demo (coming soon)
        </span>
      </div>
    </main>
  );
}
