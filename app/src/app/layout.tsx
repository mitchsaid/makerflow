import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1815" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-ZA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
