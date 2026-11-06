import { NextResponse, type NextRequest } from "next/server";
import { runDueRecurrences } from "@/lib/recurrence/run";

/**
 * Makes the day's repeats (docs/plans/recurring.md): one invoice draft for each repeat that is due. Called by the scheduler
 * (vercel.json) early in the morning, South African time; it must present the shared secret `CRON_SECRET`, which Vercel
 * sends as a bearer token. Without the secret set, it does nothing. Running it twice in a day makes the same drafts once.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDueRecurrences());
  } catch (error) {
    console.error("the repeats could not run:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "could not run" }, { status: 500 });
  }
}
