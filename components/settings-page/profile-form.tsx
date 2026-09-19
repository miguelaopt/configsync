"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updatePreferencesAction, updateProfileAction } from "@/lib/actions/profile";
import type { Profile } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import { COPY_FORMAT_LABELS, COPY_FORMATS } from "@/lib/copy/format";

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [username, setUsername] = React.useState(profile.username);
  const [displayName, setDisplayName] = React.useState(profile.displayName ?? "");
  const [isPublic, setIsPublic] = React.useState(profile.isPublic);
  const [bio, setBio] = React.useState(profile.bio ?? "");
  const [links, setLinks] = React.useState<string[]>(profile.links);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateProfileAction({
        username,
        displayName: displayName || null,
        isPublic,
        bio: bio || null,
        links: links.map((l) => l.trim()).filter(Boolean),
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      toast.success("Profile saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <Field label="Display name" htmlFor="display-name" error={errors.displayName}>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          autoComplete="name"
        />
      </Field>
      <Field
        label="Username"
        htmlFor="username"
        hint="Your public profile lives at /p/username"
        error={errors.username}
      >
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={32}
          autoComplete="username"
          spellCheck={false}
          aria-invalid={!!errors.username}
        />
      </Field>
      <Field
        label="Public profile"
        htmlFor="is-public"
        hint={
          isPublic
            ? `Live at ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/p/${username} — only presets you make public show up.`
            : "Off — nobody can see your presets, even the ones marked public."
        }
      >
        <div className="flex h-9 items-center">
          <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
      </Field>
      <Field label="Bio" htmlFor="bio" optional error={errors.bio}>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="What you play, what you stream…"
        />
      </Field>
      <Field
        label="Links"
        htmlFor="link-0"
        optional
        hint="https:// links to Twitch, YouTube, X, Discord, your site… up to 6."
        error={errors.links ?? errors["links.0"]}
      >
        <div className="flex flex-col gap-2">
          {[...links, ""].slice(0, 6).map((l, i) => (
            <Input
              key={i}
              id={`link-${i}`}
              type="url"
              value={l}
              placeholder="https://twitch.tv/you"
              onChange={(e) => {
                const next = [...links, ""];
                next[i] = e.target.value;
                setLinks(next.filter((x, j) => x !== "" || j < i));
              }}
            />
          ))}
        </div>
      </Field>
      <Field label="Email" htmlFor="email" hint="Used to sign in. Changing it isn't supported yet.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function PreferencesForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const prefs = profile.preferences;
  const [pending, startTransition] = React.useTransition();

  const update = (patch: Parameters<typeof updatePreferencesAction>[0]) =>
    startTransition(async () => {
      const r = await updatePreferencesAction(patch);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex max-w-md flex-col gap-5" aria-busy={pending}>
      <PrefRow label="Density" hint="Compact fits more settings on screen.">
        <Segmented
          aria-label="Density"
          value={prefs.density ?? "comfortable"}
          onValueChange={(v) => update({ density: v as "comfortable" | "compact" })}
          options={[
            { label: "Comfortable", value: "comfortable" },
            { label: "Compact", value: "compact" },
          ]}
        />
      </PrefRow>
      <PrefRow
        label="Default copy format"
        hint="What the main Copy button uses. Other formats stay one click away."
      >
        <Segmented
          aria-label="Default copy format"
          value={prefs.copyFormat ?? "plain"}
          onValueChange={(v) => update({ copyFormat: v as (typeof COPY_FORMATS)[number] })}
          options={COPY_FORMATS.map((f) => ({ label: COPY_FORMAT_LABELS[f], value: f }))}
        />
      </PrefRow>
    </div>
  );
}

function PrefRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
