import type { Metadata } from "next";
import { eq, and } from "drizzle-orm";
import { getProfile, requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { Page, PageHeader } from "@/components/app/page-header";
import { PreferencesForm, ProfileForm } from "@/components/settings-page/profile-form";
import { ChangePasswordForm, DeleteAccount } from "@/components/settings-page/account-forms";
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

  return (
    <Page size="lg">
      <PageHeader
        title="Settings"
        description="Your profile, how the app looks, and your account."
      />
      <div className="flex flex-col gap-10">
        <Section id="profile" title="Profile">
          <ProfileForm profile={profile} email={user.email} />
        </Section>
        <Section id="preferences" title="Preferences">
          <PreferencesForm profile={profile} />
        </Section>
        <Section id="password" title="Password">
          <ChangePasswordForm hasPassword={Boolean(credential)} />
        </Section>
        <Section id="danger" title="Delete account">
          <DeleteAccount />
        </Section>
        <p className="text-xs text-ink-3">
          GameSettings Vault {SITE.version} · open source under the MIT license ·{" "}
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
      <div>{children}</div>
    </section>
  );
}
