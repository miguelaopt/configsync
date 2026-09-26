import type { Metadata } from "next";
import { History } from "lucide-react";
import { countAudit, listAudit, ADMIN_PAGE_SIZE } from "@/lib/data/admin";
import { Panel } from "@/components/dashboard/panels";
import { AuditList } from "@/components/admin/audit-list";
import { Pager, pageParam } from "@/components/admin/pager";
import type { SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const page = pageParam((await searchParams).page);
  const [entries, total] = await Promise.all([listAudit({ page }), countAudit()]);
  return (
    <div className="flex flex-col gap-4">
      <Panel
        icon={<History />}
        title="Audit log"
        subtitle="Every action taken from Admin, kept after an account is deleted"
      >
        <AuditList entries={entries} />
      </Panel>
      <Pager
        page={page}
        total={total}
        size={ADMIN_PAGE_SIZE}
        href={(p) => `/admin/audit?page=${p}`}
      />
    </div>
  );
}
