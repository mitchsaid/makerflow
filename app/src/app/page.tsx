import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DemoPicker } from "./demo-picker";

// Building a demo business (sample customers, products, quotes and a logo) takes several seconds; a hosted function is given up to a minute.
export const maxDuration = 60;

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-12 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Quotes, jobs and invoices for people who make things
        </h1>
        <p className="text-lg text-muted-foreground">
          Send a quote, track the job, invoice for the work, and see your margin.
        </p>
      </div>
      <DemoPicker ended={params.demo === "ended"}>
        <Link href="/sign-in" className={cn(buttonVariants({ size: "lg" }), "min-w-48")}>
          Get started
        </Link>
      </DemoPicker>
    </main>
  );
}
