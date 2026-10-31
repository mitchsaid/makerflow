import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only. The dev badge sits on top of whatever is at the corner of the screen (the first tab
  // of the phone tab bar at the bottom left, the close buttons at the top right) and blocks taps and
  // browser tests, wherever it is put. Errors still show in the dev overlay; production has no badge.
  devIndicators: false,
  // A quote or invoice for the document reader (docs/plans/import-onboarding.md): the reader takes up to 4 MB, and a hosted function takes 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Materials moved out of the Products tab (2026-10-23); old links and bookmarks still arrive.
  // The quote settings moved into Quotes (2026-10-24, "Quotes and invoices" is no longer a page of its own).
  async redirects() {
    return [
      { source: "/app/products/materials/:path*", destination: "/app/materials/:path*", permanent: false },
      { source: "/app/documents", destination: "/app/quotes/settings", permanent: false },
      { source: "/app/documents/:path*", destination: "/app/quotes/settings/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
