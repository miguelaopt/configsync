import type { Metadata } from "next";
import { Suspense } from "react";
import { githubOAuthEnabled } from "@/lib/env";
import { SignUpForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm githubEnabled={githubOAuthEnabled} />
    </Suspense>
  );
}
