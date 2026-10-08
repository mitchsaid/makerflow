import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only. The dev badge sits on top of whatever is at the corner of the screen (the first tab
  // of the phone tab bar at the bottom left, the close buttons at the top right) and blocks taps and
  // browser tests, wherever it is put. Errors still show in the dev overlay; production has no badge.
  devIndicators: false,
};

export default nextConfig;
