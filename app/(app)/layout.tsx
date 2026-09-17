import { getProfile, requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app/shell";
import { ThemeSync } from "@/components/app/theme-sync";
import { getPlan } from "@/lib/billing/plan";
import { billingEnabled } from "@/lib/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, { plan }] = await Promise.all([getProfile(user.id), getPlan(user.id)]);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, image: user.image }}
      username={profile?.username ?? "you"}
      plan={billingEnabled ? plan : null}
    >
      <ThemeSync preferences={profile?.preferences ?? {}} />
      {children}
    </AppShell>
  );
}
