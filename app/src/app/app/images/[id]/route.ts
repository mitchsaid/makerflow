import type { NextRequest } from "next/server";
import { getUser } from "@/lib/auth/dal";
import { getRendition } from "@/lib/images/data";

/**
 * A picture, for people in the business. A picture never changes under its id, so the browser may
 * keep it for as long as it likes (privately: it is not for shared caches). ?size=thumb gives the
 * small square copy.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/images/[id]">) {
  const { id } = await ctx.params;
  // Row-level security limits what can be read to the business's own pictures; no need for the whole workspace.
  if (!(await getUser())) return new Response("Sign in to see this picture", { status: 401 });
  const size = request.nextUrl.searchParams.get("size") === "thumb" ? "thumb" : "display";
  const image = await getRendition(id, size);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // A picture is only ever shown, never run.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
