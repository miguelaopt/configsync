import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ConfigSync", template: "%s · ConfigSync" },
  description:
    "Your game settings. One place. Save, organize, compare, copy and export settings for any game — open source and self-hostable.",
  applicationName: "ConfigSync",
};

export const viewport: Viewport = {
  themeColor: "#12161c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved theme before first paint so light-theme users don't see a dark flash.
const themeScript = `try{var t=localStorage.getItem("csync-theme")||"dark";if(t==="system"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}if(t==="light"){document.documentElement.dataset.theme="light"}var d=localStorage.getItem("csync-density");if(d==="compact"){document.documentElement.dataset.density=d}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="csync-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
