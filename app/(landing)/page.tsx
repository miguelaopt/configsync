import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: { absolute: "ConfigSync — Sync, back up and share your game settings on every PC" },
  description:
    "Store, organise and compare the settings and config files you use for any PC game — CS2, Rocket League and more — then put the setup you want on any PC. Every save keeps a snapshot you can restore.",
  alternates: { canonical: "/" },
};

/** Signed-in users go straight to the app; everyone else gets the landing page. */
export default async function LandingPage() {
  if (await getSession()) redirect("/dashboard");
  return <Landing />;
}
