"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Info,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { Game, Preset, Setting, UserPreferences } from "@/lib/db/schema";
import type { CategoryWithSettings } from "@/lib/data/presets";
import type { SettingFileInfo } from "@/lib/catalog";
import {
  deleteCategoryAction,
  deleteSettingAction,
  duplicateCategoryAction,
  reorderCategoriesAction,
  reorderSettingsAction,
  resetToDefaultsAction,
  saveSettingValuesAction,
  setCategoryCollapsedAction,
} from "@/lib/actions/settings";
import {
  COPY_FORMATS,
  COPY_FORMAT_LABELS,
  formatForCopy,
  type CopyFormat,
  type CopyPayload,
} from "@/lib/copy/format";
import { copyWithToast } from "@/lib/copy/use-copy";
import { formatValue, valuesEqual, type SettingValue } from "@/lib/settings/types";
import { CATEGORY_ICONS } from "@/lib/settings/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingControl, isWideControl } from "./setting-control";
import { SettingDialog } from "./setting-dialog";
import { CategoryDialog } from "./category-dialog";
import { SettingDetails } from "./setting-details";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Props = {
  game: Game;
  preset: Preset;
  categories: CategoryWithSettings[];
  preferences: UserPreferences;
  /** Setting name → where a catalog game keeps it on disk; null for games outside the catalog. */
  files?: Record<string, SettingFileInfo> | null;
};

type Drafts = Record<string, SettingValue | null>;

const settingToDoc = (s: Setting, value?: SettingValue | null) => ({
  name: s.name,
  type: s.type,
  value: value === undefined ? ((s.value as SettingValue | null) ?? null) : value,
  unit: s.unit,
  options: s.options,
  min: s.min,
  max: s.max,
  step: s.step,
  description: s.description,
  notes: s.notes,
  defaultValue: (s.defaultValue as SettingValue | null) ?? null,
});

export function PresetEditor({ game, preset, categories, preferences, files = null }: Props) {
  const router = useRouter();
  const copyFormat = preferences.copyFormat ?? "plain";
  const [drafts, setDrafts] = React.useState<Drafts>({});
  const [saving, setSaving] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(
    categories[0]?.id ?? null,
  );

  const dirtyIds = Object.keys(drafts);
  const dirtyCount = dirtyIds.length;

  const setDraft = React.useCallback((setting: Setting, value: SettingValue | null) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (valuesEqual(value, (setting.value as SettingValue | null) ?? null))
        delete next[setting.id];
      else next[setting.id] = value;
      return next;
    });
  }, []);

  const valueOf = (s: Setting): SettingValue | null =>
    s.id in drafts ? drafts[s.id]! : ((s.value as SettingValue | null) ?? null);

  const save = React.useCallback(async () => {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    const updates = dirtyIds.map((id) => ({ id, value: drafts[id] }));
    const result = await saveSettingValuesAction(preset.id, updates);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDrafts({});
    toast.success(`Saved ${plural(updates.length, "change")}`);
    router.refresh();
  }, [dirtyCount, dirtyIds, drafts, preset.id, router, saving]);

  const discard = () => {
    setDrafts({});
    toast("Changes discarded");
  };

  // ⌘S saves, warn before leaving with unsaved edits.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyCount > 0) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save, dirtyCount]);

  // Scroll-spy for the category rail.
  React.useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(`category-${c.id}`))
      .filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCategory(visible[0].target.id.replace("category-", ""));
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [categories]);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copySelected = async (format: CopyFormat) => {
    const payload: CopyPayload = {
      categories: categories
        .map((c) => ({
          name: c.name,
          settings: c.settings
            .filter((s) => selected.has(s.id))
            .map((s) => settingToDoc(s, valueOf(s))),
        }))
        .filter((c) => c.settings.length > 0),
    };
    const ok = await copyWithToast(
      formatForCopy(payload, format),
      `Copied ${plural(selected.size, "setting")} as ${COPY_FORMAT_LABELS[format].toLowerCase()}`,
    );
    if (ok) {
      setSelectMode(false);
      setSelected(new Set());
    }
  };

  const move = async (
    list: { id: string }[],
    id: string,
    dir: -1 | 1,
    apply: (ids: string[]) => Promise<{ ok: boolean; error?: string }>,
  ) => {
    const ids = list.map((x) => x.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    const r = await apply(ids);
    if (!r.ok) toast.error(r.error);
    else router.refresh();
  };

  const totalSettings = categories.reduce((n, c) => n + c.settings.length, 0);

  return (
    <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
      {/* Desktop rail */}
      <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto lg:block">
        <nav aria-label="Categories">
          <ul className="flex flex-col gap-0.5">
            {categories.map((c) => {
              const Icon = c.icon ? CATEGORY_ICONS[c.icon] : null;
              const dirtyHere = c.settings.some((s) => s.id in drafts);
              return (
                <li key={c.id}>
                  <a
                    href={`#category-${c.id}`}
                    aria-current={activeCategory === c.id ? "true" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-sm border-l-2 px-2.5 text-[13px] transition-colors",
                      activeCategory === c.id
                        ? "border-accent bg-raised text-ink"
                        : "border-transparent text-ink-2 hover:bg-surface hover:text-ink",
                    )}
                  >
                    {Icon ? <Icon className="size-4 shrink-0 text-ink-3" aria-hidden /> : null}
                    <span className="truncate">{c.name}</span>
                    <span className="tnum ml-auto text-xs text-ink-3">{c.settings.length}</span>
                    {dirtyHere ? (
                      <span
                        className="size-1.5 rounded-full bg-accent"
                        aria-label="Unsaved changes"
                      />
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-ink-2"
          onClick={() => setAddingCategory(true)}
        >
          <Plus /> Add category
        </Button>
      </aside>

      <div className="min-w-0">
        {/* Mobile chip rail */}
        {categories.length > 0 ? (
          <div className="no-scrollbar sticky top-14 z-30 -mx-4 mb-4 flex gap-1.5 overflow-x-auto border-b border-line bg-ground/95 px-4 py-2 backdrop-blur-sm lg:hidden">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#category-${c.id}`}
                aria-current={activeCategory === c.id ? "true" : undefined}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-sm border px-3 text-[13px] whitespace-nowrap",
                  activeCategory === c.id
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line text-ink-2",
                )}
              >
                {c.name}
              </a>
            ))}
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-sm border border-dashed border-line px-3 text-[13px] text-ink-3"
            >
              <Plus className="size-3.5" /> Add
            </button>
          </div>
        ) : null}

        {/* Toolbar */}
        {totalSettings > 0 ? (
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink-3">
              {plural(categories.length, "category", "categories")} ·{" "}
              {plural(totalSettings, "setting")}
            </p>
            {selectMode ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-ink-2">{selected.size} selected</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="primary" disabled={selected.size === 0}>
                      <Copy /> Copy selected <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {COPY_FORMATS.map((f) => (
                      <DropdownMenuItem key={f} onSelect={() => copySelected(f)}>
                        {COPY_FORMAT_LABELS[f]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectMode(false);
                    setSelected(new Set());
                  }}
                >
                  <X /> Done
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setSelectMode(true)}>
                <ListChecks /> Select
              </Button>
            )}
          </div>
        ) : null}

        {categories.length === 0 ? (
          <EmptyState
            title="Build this preset's menu"
            description="Categories mirror the game's own tabs — Controls, Display, Audio. Add one, then fill it with settings."
            action={
              <Button variant="primary" onClick={() => setAddingCategory(true)}>
                <Plus /> Add category
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-8">
            {categories.map((category, index) => (
              <CategorySection
                key={category.id}
                category={category}
                index={index}
                count={categories.length}
                allCategories={categories}
                presetId={preset.id}
                drafts={drafts}
                valueOf={valueOf}
                setDraft={setDraft}
                copyFormat={copyFormat}
                selectMode={selectMode}
                selected={selected}
                toggleSelected={toggleSelected}
                files={files}
                catalogGame={Boolean(game.catalogId)}
                onMove={(dir) =>
                  move(categories, category.id, dir, (ids) =>
                    reorderCategoriesAction(preset.id, ids),
                  )
                }
                onMoveSetting={(id, dir) =>
                  move(category.settings, id, dir, (ids) => reorderSettingsAction(category.id, ids))
                }
              />
            ))}
            <div className="lg:hidden">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setAddingCategory(true)}
              >
                <Plus /> Add category
              </Button>
            </div>
          </div>
        )}
      </div>

      {dirtyCount > 0 ? (
        <div
          className="safe-bottom fixed inset-x-0 bottom-14 z-40 flex justify-center px-3 pb-2 lg:bottom-0 lg:pb-4"
          role="region"
          aria-live="polite"
          aria-label="Unsaved changes"
        >
          <div className="flex w-full max-w-lg items-center gap-2 rounded-md border border-line bg-overlay px-3 py-2 shadow-dialog">
            <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {plural(dirtyCount, "unsaved change")}
            </span>
            <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={save} loading={saving}>
              <Save /> Save
            </Button>
          </div>
        </div>
      ) : null}

      <CategoryDialog
        open={addingCategory}
        onOpenChange={setAddingCategory}
        presetId={preset.id}
        existingNames={categories.map((c) => c.name)}
      />
      <span className="sr-only">{game.name}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------

type SectionProps = {
  category: CategoryWithSettings;
  index: number;
  count: number;
  allCategories: CategoryWithSettings[];
  presetId: string;
  drafts: Drafts;
  valueOf: (s: Setting) => SettingValue | null;
  setDraft: (s: Setting, v: SettingValue | null) => void;
  copyFormat: CopyFormat;
  selectMode: boolean;
  selected: Set<string>;
  toggleSelected: (id: string) => void;
  files: Record<string, SettingFileInfo> | null;
  catalogGame: boolean;
  onMove: (dir: -1 | 1) => void;
  onMoveSetting: (id: string, dir: -1 | 1) => void;
};

function CategorySection({
  category,
  index,
  count,
  allCategories,
  presetId,
  drafts,
  valueOf,
  setDraft,
  copyFormat,
  selectMode,
  selected,
  toggleSelected,
  files,
  catalogGame,
  onMove,
  onMoveSetting,
}: SectionProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(category.isCollapsed);
  const [adding, setAdding] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const Icon = category.icon ? CATEGORY_ICONS[category.icon] : null;
  const categoryList = allCategories.map((c) => ({ id: c.id, name: c.name }));

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void setCategoryCollapsedAction(category.id, next);
  };

  const copyCategory = (format: CopyFormat) =>
    copyWithToast(
      formatForCopy(
        {
          categories: [
            {
              name: category.name,
              settings: category.settings.map((s) => settingToDoc(s, valueOf(s))),
            },
          ],
        },
        format,
      ),
      `Copied ${category.name} as ${COPY_FORMAT_LABELS[format].toLowerCase()}`,
    );

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p;
    if (!r.ok) return toast.error(r.error);
    toast.success(msg);
    router.refresh();
  };

  const hasDefaults = category.settings.some((s) => s.defaultValue != null);

  return (
    <section
      id={`category-${category.id}`}
      aria-labelledby={`category-${category.id}-title`}
      className="scroll-mt-32 lg:scroll-mt-20"
    >
      <div className="flex items-center gap-2 border-b border-line-strong pb-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={`category-${category.id}-body`}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-3 transition-transform",
              collapsed && "-rotate-90",
            )}
            aria-hidden
          />
          {Icon ? <Icon className="size-4 shrink-0 text-accent" aria-hidden /> : null}
          <h2 id={`category-${category.id}-title`} className="truncate font-display text-[19px]">
            {category.name}
          </h2>
          <span className="tnum text-xs text-ink-3">{category.settings.length}</span>
        </button>
        <Tooltip content="Add setting">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add setting to ${category.name}`}
            onClick={() => setAdding(true)}
          >
            <Plus />
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${category.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Copy /> Copy category
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {COPY_FORMATS.map((f) => (
                  <DropdownMenuItem key={f} onSelect={() => copyCategory(f)}>
                    {COPY_FORMAT_LABELS[f]}
                    {f === copyFormat ? (
                      <span className="ml-auto text-xs text-ink-3">default</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onSelect={() => run(duplicateCategoryAction(category.id), "Category duplicated")}
            >
              <Copy /> Duplicate
            </DropdownMenuItem>
            {hasDefaults ? (
              <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
                <RotateCcw /> Reset to defaults…
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}>
              <ArrowDown /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div id={`category-${category.id}-body`} hidden={collapsed}>
        {category.settings.length === 0 ? (
          <div className="flex items-center justify-between gap-3 py-4 pl-3">
            <p className="text-[13px] text-ink-3">No settings in {category.name} yet.</p>
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus /> Add setting
            </Button>
          </div>
        ) : (
          <ul>
            {category.settings.map((setting, i) => (
              <SettingRow
                key={setting.id}
                setting={setting}
                value={valueOf(setting)}
                dirty={setting.id in drafts}
                onChange={(v) => setDraft(setting, v)}
                categories={categoryList}
                copyFormat={copyFormat}
                selectMode={selectMode}
                checked={selected.has(setting.id)}
                onToggleSelected={() => toggleSelected(setting.id)}
                category={category.name}
                file={files?.[setting.name] ?? null}
                catalogGame={catalogGame}
                canMoveUp={i > 0}
                canMoveDown={i < category.settings.length - 1}
                onMove={(dir) => onMoveSetting(setting.id, dir)}
              />
            ))}
            <li>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex h-10 w-full cursor-pointer items-center gap-2 pl-3 text-[13px] text-ink-3 transition-colors hover:text-ink"
              >
                <Plus className="size-4" aria-hidden /> Add setting
              </button>
            </li>
          </ul>
        )}
      </div>

      <SettingDialog
        open={adding}
        onOpenChange={setAdding}
        categories={categoryList}
        categoryId={category.id}
      />
      <CategoryDialog
        open={renaming}
        onOpenChange={setRenaming}
        presetId={presetId}
        category={category}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${category.name}”?`}
        description={`${plural(category.settings.length, "setting")} will be deleted with it.`}
        confirmLabel="Delete category"
        onConfirm={() => run(deleteCategoryAction(category.id), "Category deleted")}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={`Reset ${category.name} to defaults?`}
        description="Every setting with a default value goes back to it. Settings without a default are left alone."
        confirmLabel="Reset"
        confirmVariant="primary"
        onConfirm={() =>
          run(resetToDefaultsAction({ categoryId: category.id }), "Reset to defaults")
        }
      />
    </section>
  );
}

// -----------------------------------------------------------------------------

type RowProps = {
  setting: Setting;
  value: SettingValue | null;
  dirty: boolean;
  onChange: (v: SettingValue | null) => void;
  categories: { id: string; name: string }[];
  copyFormat: CopyFormat;
  selectMode: boolean;
  checked: boolean;
  onToggleSelected: () => void;
  category: string;
  file: SettingFileInfo | null;
  catalogGame: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
};

function SettingRow({
  setting,
  value,
  dirty,
  onChange,
  categories,
  copyFormat,
  selectMode,
  checked,
  onToggleSelected,
  category,
  file,
  catalogGame,
  canMoveUp,
  canMoveDown,
  onMove,
}: RowProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [details, setDetails] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const controlId = `setting-${setting.id}-control`;
  const wide = isWideControl(setting.type);
  const defaultValue = (setting.defaultValue as SettingValue | null) ?? null;
  const canReset = defaultValue != null && !valuesEqual(defaultValue, value);

  const copyOne = (format: CopyFormat) =>
    copyWithToast(
      formatForCopy(
        { categories: [{ name: "", settings: [settingToDoc(setting, value)] }] },
        format,
      ),
      `Copied ${setting.name}`,
    );

  return (
    <li
      id={`setting-${setting.id}`}
      className={cn("menu-row scroll-mt-32 lg:scroll-mt-20", selectMode && "cursor-pointer")}
      data-active={checked || undefined}
      onClick={selectMode ? onToggleSelected : undefined}
    >
      <div
        className={cn("flex items-center gap-3 py-2 pr-1 pl-3", wide && "flex-wrap sm:flex-nowrap")}
      >
        {selectMode ? (
          <Checkbox
            checked={checked}
            onCheckedChange={onToggleSelected}
            aria-label={`Select ${setting.name}`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
        <div className={cn("min-w-0 flex-1")}>
          <div className="flex items-center gap-1.5 text-[14px] text-ink">
            {selectMode ? (
              <span className="truncate">{setting.name}</span>
            ) : (
              // The control carries its own aria-label; the name opens the details.
              <button
                type="button"
                onClick={() => setDetails(true)}
                className="cursor-pointer truncate rounded-sm text-left underline-offset-4 hover:underline"
                aria-label={`Details for ${setting.name}`}
              >
                {setting.name}
              </button>
            )}
            {dirty ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden /> edited
              </span>
            ) : null}
          </div>
          {setting.description ? (
            <p className="truncate text-xs text-ink-3">{setting.description}</p>
          ) : null}
        </div>
        {selectMode ? (
          <span className="tnum max-w-[45%] truncate text-[13px] text-ink-2">
            {formatValue(setting, value)}
          </span>
        ) : (
          <div
            className={cn(
              "flex items-center justify-end",
              wide
                ? "order-3 basis-full pb-1 sm:order-none sm:max-w-[60%] sm:basis-auto sm:pb-0"
                : "shrink-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <SettingControl
              def={setting}
              value={value}
              onChange={onChange}
              id={controlId}
              label={setting.name}
            />
          </div>
        )}
        {!selectMode ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${setting.name}`}
                className={cn("shrink-0 text-ink-3", wide && "order-2 sm:order-none")}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setDetails(true)}>
                <Info /> Details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit…
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Copy /> Copy
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {COPY_FORMATS.map((f) => (
                    <DropdownMenuItem key={f} onSelect={() => copyOne(f)}>
                      {COPY_FORMAT_LABELS[f]}
                      {f === copyFormat ? (
                        <span className="ml-auto text-xs text-ink-3">default</span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {defaultValue != null ? (
                <DropdownMenuItem disabled={!canReset} onSelect={() => onChange(defaultValue)}>
                  <RotateCcw /> Reset to {formatValue(setting, defaultValue)}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}>
                <ArrowUp /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}>
                <ArrowDown /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {setting.notes ? <p className="-mt-1 pb-2 pl-3 text-xs text-ink-3">{setting.notes}</p> : null}
      <SettingDetails
        open={details}
        onOpenChange={setDetails}
        setting={setting}
        value={value}
        category={category}
        file={file}
        catalogGame={catalogGame}
        onReset={onChange}
        onEdit={() => setEditing(true)}
        onCopy={() => copyOne(copyFormat)}
      />
      <SettingDialog
        open={editing}
        onOpenChange={setEditing}
        categories={categories}
        categoryId={setting.categoryId}
        setting={setting}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${setting.name}”?`}
        confirmLabel="Delete setting"
        onConfirm={async () => {
          const r = await deleteSettingAction(setting.id);
          if (!r.ok) return toast.error(r.error);
          toast.success("Setting deleted");
          router.refresh();
        }}
      />
    </li>
  );
}
