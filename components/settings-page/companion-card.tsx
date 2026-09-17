"use client";
import * as React from "react";
import { toast } from "sonner";
import { createCompanionTokenAction, revokeCompanionTokenAction } from "@/lib/actions/companion";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { copyWithToast } from "@/lib/copy/use-copy";
import { plural, timeAgo } from "@/lib/utils/format";
import { SITE } from "@/lib/site";

type Token = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null };
type Device = { device: string; games: number; seenAt: Date | null };

/** Personal access tokens for the companion CLI, plus the devices it has scanned. */
export function CompanionCard({
  tokens,
  devices,
  appUrl,
}: {
  tokens: Token[];
  devices: Device[];
  appUrl: string;
}) {
  const [name, setName] = React.useState("");
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<Token | null>(null);
  const [pending, start] = React.useTransition();

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createCompanionTokenAction(name);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setFresh(r.data.token);
      setName("");
    });
  };

  return (
    <div className="flex flex-col gap-6 text-[13px]">
      <div className="rounded-sm border border-line p-3">
        <p className="text-ink">Install the companion on your gaming PC:</p>
        <pre className="mt-2 overflow-x-auto rounded-xs bg-raised p-2 font-mono text-xs">{`git clone ${SITE.repoUrl} && cd configsync/companion && npm i -g .\ngsv login ${appUrl}\ngsv scan --push\ngsv import cs2`}</pre>
        <p className="mt-2 text-ink-3">
          It reads your game config files and never writes without a backup. Docs:{" "}
          <a
            href={`${SITE.repoUrl}/blob/main/${SITE.docsCompanion}`}
            className="underline underline-offset-4 hover:text-ink"
          >
            {SITE.docsCompanion}
          </a>
        </p>
      </div>

      <form onSubmit={create} className="flex items-end gap-2">
        <Field label="New token" htmlFor="tok-name" className="flex-1">
          <Input
            id="tok-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gaming PC"
            maxLength={60}
            required
          />
        </Field>
        <Button type="submit" variant="primary" loading={pending}>
          Create token
        </Button>
      </form>
      {fresh ? (
        <div role="alert" className="rounded-sm border border-line-strong p-3">
          <p className="text-ink">Copy it now — it won’t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xs bg-raised p-2 font-mono text-xs">
              {fresh}
            </code>
            <Button size="sm" onClick={() => copyWithToast(fresh, "Token copied")}>
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="divide-y divide-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <span className="text-ink">{t.name}</span>
              <span className="text-ink-3">
                created {timeAgo(t.createdAt)}
                {t.lastUsedAt ? ` · used ${timeAgo(t.lastUsedAt)}` : " · never used"}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRevoking(t)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {devices.length > 0 ? (
        <div>
          <p className="font-medium text-ink">Devices</p>
          <ul className="mt-1 text-ink-2">
            {devices.map((d) => (
              <li key={d.device}>
                {d.device} — {plural(d.games, "game")}, scanned{" "}
                {d.seenAt ? timeAgo(d.seenAt) : "never"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={revoking != null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke “${revoking?.name}”?`}
        description="The companion using it will stop working until you log in with a new token."
        confirmLabel="Revoke"
        loading={pending}
        onConfirm={() =>
          start(async () => {
            const r = await revokeCompanionTokenAction(revoking!.id);
            setRevoking(null);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success("Token revoked");
          })
        }
      />
    </div>
  );
}
