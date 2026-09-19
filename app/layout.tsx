import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const description =
  "Your game settings. One place. Save, organize, compare, copy and export settings for any game.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://configsync.app"),
  title: { default: "ConfigSync", template: "%s · ConfigSync" },
  description,
  applicationName: "ConfigSync",
  openGraph: { type: "website", siteName: "ConfigSync", title: "ConfigSync", description },
  twitter: { card: "summary_large_image", title: "ConfigSync", description },
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
