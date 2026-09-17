import type { Metadata } from "next";
import { eq, and } from "drizzle-orm";
import { getProfile, requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { Page, PageHeader } from "@/components/app/page-header";
import { PreferencesForm, ProfileForm } from "@/components/settings-page/profile-form";
import { ChangePasswordForm, DeleteAccount } from "@/components/settings-page/account-forms";
import { CompanionCard } from "@/components/settings-page/companion-card";
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

  return (
    <Page size="lg">
      <PageHeader
        title="Settings"
        description="Your profile, how the app looks, and your account."
      />
      <div className="flex flex-col gap-10">
        {billingEnabled ? (
          <Section id="plan" title="Plan">
            <PlanCard info={plan} email={user.email} userId={user.id} prices={prices} />
          </Section>
        ) : null}
        <Section id="profile" title="Profile">
          <ProfileForm profile={profile} email={user.email} />
        </Section>
        <Section id="preferences" title="Preferences">
          <PreferencesForm profile={profile} />
        </Section>
        <Section id="companion" title="Companion">
          <CompanionCard tokens={tokens} devices={devices} appUrl={env.BETTER_AUTH_URL} />
        </Section>
        <Section id="password" title="Password">
          <ChangePasswordForm hasPassword={Boolean(credential)} />
        </Section>
        <Section id="danger" title="Delete account">
          <DeleteAccount />
        </Section>
        <p className="text-xs text-ink-3">
          ConfigSync {SITE.version} · source-available under the FSL ·{" "}
          <a
            href={SITE.repoUrl}
            className="underline underline-offset-4 hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            source code
          </a>
        </p>
      </div>
    </Page>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 gap-4 border-t border-line pt-6 md:grid-cols-[200px_1fr]"
    >
      <h2 id={`${id}-title`} className="font-display text-[19px]">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
