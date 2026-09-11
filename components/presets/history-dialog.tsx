"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, History } from "lucide-react";
import { createRevisionAction, restoreRevisionAction } from "@/lib/actions/presets";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { plural, timeAgo } from "@/lib/utils/format";

export type RevisionSummary = {
  id: string;
  note: string | null;
  createdAt: Date;
  settingCount: number;
};

/** Revision list with restore. Restoring saves the current state first, so nothing is lost. */
export function HistoryDialog({
  open,
  onOpenChange,
  presetId,
  revisions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetId: string;
  revisions: RevisionSummary[];
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [restoring, setRestoring] = React.useState<RevisionSummary | null>(null);

  const snapshot = () =>
    startTransition(async () => {
      const r = await createRevisionAction(presetId, note);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Snapshot saved");
      setNote("");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="History"
        description="A snapshot is taken every time you save values. You can also save one manually with a note."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            snapshot();
          }}
          className="flex gap-2"
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. before trying 800 DPI"
            maxLength={200}
            aria-label="Snapshot note"
          />
          <Button type="submit" variant="secondary" loading={pending}>
            <Camera /> Snapshot
          </Button>
        </form>
        {revisions.length === 0 ? (
          <p className="mt-6 text-center text-[13px] text-ink-3">No snapshots yet.</p>
        ) : (
          <ol className="mt-4 divide-y divide-hairline border-y border-hairline">
            {revisions.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <History className="size-4 shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">
                    {r.note || (i === 0 ? "Latest snapshot" : "Snapshot")}
                  </p>
                  <p className="text-xs text-ink-3">
                    {timeAgo(r.createdAt)} · {plural(r.settingCount, "setting")}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRestoring(r)}>
                  Restore
                </Button>
              </li>
            ))}
          </ol>
        )}
        <ConfirmDialog
          open={restoring != null}
          onOpenChange={(o) => !o && setRestoring(null)}
          title="Restore this snapshot?"
          description="The preset's categories and settings are replaced with the snapshot. Your current state is saved as a new snapshot first, so you can undo this."
          confirmLabel="Restore"
          confirmVariant="primary"
          onConfirm={async () => {
            if (!restoring) return;
            const r = await restoreRevisionAction(presetId, restoring.id);
            if (!r.ok) return toast.error(r.error);
            toast.success("Snapshot restored");
            onOpenChange(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
