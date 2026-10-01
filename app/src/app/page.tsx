import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-12 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Quotes, jobs and invoices for people who make things
        </h1>
        <p className="text-lg text-muted-foreground">
          Send a beautiful quote, track the job, invoice for the work, and see your
          margin on every order.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          Get started
        </Link>
        <Button variant="outline" size="lg" disabled>
          Try the demo (coming soon)
        </Button>
      </div>
    </main>
  );
}
