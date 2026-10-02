import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only. The default bottom-left badge sits on top of the first tab of the
  // phone tab bar, which blocks taps (and browser tests). Production has no badge.
  devIndicators: { position: "top-right" },
};

export default nextConfig;
