import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// The words people actually type: "ConfigSync" alone collides with unrelated game mods, so the
// title and description carry the category and the games the catalog ships with.
const title = "ConfigSync — Sync, back up and share your game settings";
const description =
  "Save your game settings and config files in one place, keep presets per game and per PC, compare and restore any version, and sync them to every PC you play on. CS2, Rocket League and any other PC game.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://configsync.app"),
  title: { default: title, template: "%s · ConfigSync" },
  description,
  applicationName: "ConfigSync",
  keywords: [
    "game settings sync",
    "game config backup",
    "game settings manager",
    "sync game settings between PCs",
    "CS2 config backup",
    "CS2 autoexec sync",
    "Rocket League settings",
    "game presets",
    "keybinds backup",
  ],
  openGraph: { type: "website", siteName: "ConfigSync", title, description },
  twitter: { card: "summary_large_image", title, description },
  // Search Console / Bing can also verify by DNS; the meta tag is for when that is inconvenient.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#161826",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved density before first paint so compact users don't see rows resize.
const densityScript = `try{var d=localStorage.getItem("csync-density");if(d==="compact"){document.documentElement.dataset.density=d}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="csync-density" strategy="beforeInteractive">
          {densityScript}
        </Script>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
