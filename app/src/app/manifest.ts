import type { MetadataRoute } from "next";

/**
 * What makes MakerFlow installable (docs/plans/installable-app.md): on a phone "Add to home screen" gives it its own icon
 * and opens it full screen, like an app. It starts at the workspace (a signed-out person is sent to sign in).
 * The colours are the app's own (--background and --primary in globals.css); the icons are drawn by
 * scripts/make-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MakerFlow",
    short_name: "MakerFlow",
    description: "Quotes, jobs and invoices for people who make things, with your margin on every order.",
    lang: "en-ZA",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
