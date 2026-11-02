import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Fraunces (titles) and DM Sans (everything else): self-hosted by Next at build time, no request to Google at runtime.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "MakerFlow",
  description:
    "Quotes, jobs and invoices for small-scale makers and artisans, with margins on every order.",
  // iPhones ignore parts of the manifest: these make "Add to Home Screen" there give the icon and a full-screen app.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "MakerFlow", statusBarStyle: "default" },
};

// Installed to a phone's home screen the app fills the screen, behind the notch and the home bar: the tab bar and the pinned
// action bars add the safe-area inset themselves (--tabbar-h in globals.css). The browser's own bar takes the page's colour.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ec" },
    { media: "(prefers-color-scheme: dark)", color: "#14110e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the script below before the first paint (the Appearance choice), so the server's html differs by that one attribute.
    <html
      lang="en-ZA"
      className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
