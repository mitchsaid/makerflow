import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredDemos } from "@/lib/demo/purge";

/**
 * Throws away demos that have run out (docs/plans/demo-accounts.md). Called by the scheduler (vercel.json); it must
 * present the shared secret `CRON_SECRET`, which Vercel sends as a bearer token. Without the secret set, it does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  const removed = await purgeExpiredDemos(100);
  return NextResponse.json({ removed });
}
