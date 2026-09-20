import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { Page } from "@/components/app/page-header";
import { LibraryExport } from "@/components/export/library-export";

export const metadata: Metadata = { title: "Export" };

export default async function ExportPage() {
  const user = await requireUser();
  const { totals } = await getDashboardData(user.id);
  return (
    <Page size="xl">
      <LibraryExport userId={user.id} totals={totals} />
    </Page>
  );
}
