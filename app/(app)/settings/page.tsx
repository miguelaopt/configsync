import type { Metadata } from "next";
import { eq, and } from "drizzle-orm";
import { Crown, KeyRound, Laptop, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { Page, PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/dashboard/panels";
import { PreferencesForm, ProfileForm } from "@/components/settings-page/profile-form";
import { ChangePasswordForm, DeleteAccount } from "@/components/settings-page/account-forms";
import { CompanionCard } from "@/components/settings-page/companion-card";
import { SectionNav } from "@/components/settings-page/section-nav";
import { listCompanionTokens } from "@/lib/data/companion-tokens";
import { listDevices } from "@/lib/data/devices";
import { billingEnabled, env } from "@/lib/env";
import { getPlan } from "@/lib/billing/plan";
import { PlanCard } from "@/components/settings-page/plan-card";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return null;
  const credential = await db.query.accounts.findFirst({
    where: and(eq(schema.accounts.userId, user.id), eq(schema.accounts.providerId, "credential")),
    columns: { id: true },
  });
  const [tokens, devices, plan] = await Promise.all([
    listCompanionTokens(user.id),
    listDevices(user.id),
    getPlan(user.id),
  ]);
  const prices =
    env.PADDLE_PRICE_MONTHLY && env.PADDLE_PRICE_LIFETIME
      ? { monthly: env.PADDLE_PRICE_MONTHLY, lifetime: env.PADDLE_PRICE_LIFETIME }
      : null;

  const sections = [
    ...(billingEnabled ? [{ id: "plan", label: "Plan", icon: <Crown /> }] : []),
    { id: "profile", label: "Profile", icon: <UserRound /> },
    { id: "preferences", label: "Preferences", icon: <SlidersHorizontal /> },
    { id: "companion", label: "Companion", icon: <Laptop /> },
    { id: "password", label: "Password", icon: <KeyRound /> },
    { id: "danger", label: "Delete account", icon: <Trash2 /> },
  ];

  return (
    <Page size="xl">
      <PageHeader
        title="Settings"
        description={`Signed in as ${user.email}. Your plan, your public profile, the companion on your PCs, and your account.`}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <SectionNav sections={sections} />
        <div className="flex max-w-4xl min-w-0 flex-col gap-5">
          {billingEnabled ? (
            <Panel
              id="plan"
              icon={<Crown />}
              title="Plan"
              subtitle="What you are on, and how to change it."
            >
              <PlanCard info={plan} email={user.email} userId={user.id} prices={prices} />
            </Panel>
          ) : null}
          <Panel
            id="profile"
            icon={<UserRound />}
            title="Profile"
            subtitle="Your name, public page and links."
          >
            <ProfileForm profile={profile} email={user.email} />
          </Panel>
          <Panel
            id="preferences"
            icon={<SlidersHorizontal />}
            title="Preferences"
            subtitle="How the app looks and what Copy gives you."
          >
            <PreferencesForm profile={profile} />
          </Panel>
          <Panel
            id="companion"
            icon={<Laptop />}
            title="Companion"
            subtitle="The CLI on your gaming PCs, its tokens and the PCs it has seen."
          >
            <CompanionCard tokens={tokens} devices={devices} appUrl={env.BETTER_AUTH_URL} />
          </Panel>
          <Panel
            id="password"
            icon={<KeyRound />}
            title="Password"
            subtitle="Change the one you sign in with."
          >
            <ChangePasswordForm hasPassword={Boolean(credential)} />
          </Panel>
          <Panel
            id="danger"
            icon={<Trash2 />}
            title="Delete account"
            subtitle="Everything goes, immediately. Export first."
            className="border-bad/50 [&_header_span]:bg-bad-soft [&_header_span]:text-bad"
          >
            <DeleteAccount />
          </Panel>
          <p className="text-xs text-ink-3">ConfigSync {SITE.version}</p>
        </div>
      </div>
    </Page>
  );
}
