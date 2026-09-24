import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

// ponytail: a side-by-side preview of the richer backgrounds, kept out of search until it replaces /.
export const metadata: Metadata = {
  title: { absolute: "ConfigSync: landing v3 preview" },
  robots: { index: false, follow: false },
};

export default function LandingV3() {
  return <Landing rich />;
}
