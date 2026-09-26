import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { Page } from "@/components/app/page-header";
import { AdminTabs } from "@/components/admin/admin-tabs";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · ConfigSync" },
  robots: { index: false, follow: false },
};

/** Everything under /admin: admins only, a 404 for anyone else. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <Page size="xl">
      <h1 className="text-brand w-fit text-[34px] leading-none font-bold sm:text-[40px]">Admin</h1>
      <p className="mt-2.5 mb-6 text-[15px] text-ink-2">
        Accounts, money, usage and the server, from the database as it is now.
      </p>
      <AdminTabs />
      {children}
    </Page>
  );
}
