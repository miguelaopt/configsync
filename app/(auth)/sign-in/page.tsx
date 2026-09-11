import type { Metadata } from "next";
import { Suspense } from "react";
import { githubOAuthEnabled } from "@/lib/env";
import { SignInForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm githubEnabled={githubOAuthEnabled} />
    </Suspense>
  );
}
