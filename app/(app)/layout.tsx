import { getProfile, requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app/shell";
import { ThemeSync } from "@/components/app/theme-sync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, image: user.image }}
      username={profile?.username ?? "you"}
    >
      <ThemeSync preferences={profile?.preferences ?? {}} />
      {children}
    </AppShell>
  );
}
