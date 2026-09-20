import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { exportGame, exportLibrary, exportPreset } from "@/lib/data/export";
import { buildExportFile, toCsv, toJson, toMarkdown } from "@/lib/import-export/serialize";
import { zipFiles } from "@/lib/import-export/zip";
import { AppError } from "@/lib/data/errors";
import { slugify } from "@/lib/utils/slug";

const query = z.object({
  scope: z.enum(["library", "game", "preset"]).default("library"),
  id: z.uuid().optional(),
  format: z.enum(["json", "md", "csv", "zip"]).default("json"),
  archived: z.enum(["1", "0"]).default("0"),
});

/** File downloads: /api/export?scope=library|game|preset&id=…&format=json|md|csv|zip (zip = all three) */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to export." }, { status: 401 });
  const url = new URL(req.url);
  const parsed = query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  const { scope, id, format, archived } = parsed.data;
  if (scope !== "library" && !id)
    return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    const userId = session.user.id;
    const games =
      scope === "library"
        ? await exportLibrary(userId, { includeArchived: archived === "1" })
        : scope === "game"
          ? [await exportGame(userId, id!)]
          : [await exportPreset(userId, id!)];

    const stamp = new Date().toISOString().slice(0, 10);
    const base =
      scope === "library"
        ? `configsync-library-${stamp}`
        : scope === "game"
          ? `${slugify(games[0]!.name)}-${stamp}`
          : `${slugify(games[0]!.name)}-${slugify(games[0]!.presets[0]?.name ?? "preset")}-${stamp}`;

    const render = {
      json: () => toJson(buildExportFile(games, scope)),
      md: () => toMarkdown(games),
      csv: () => toCsv(games),
    };
    const body =
      format === "zip"
        ? new Uint8Array(
            zipFiles(
              (["json", "md", "csv"] as const).map((f) => ({
                name: `${base}.${f}`,
                data: render[f](),
              })),
            ),
          )
        : render[format]();
    const type = {
      json: "application/json; charset=utf-8",
      md: "text/markdown; charset=utf-8",
      csv: "text/csv; charset=utf-8",
      zip: "application/zip",
    }[format];
    const presets = games.reduce((n, g) => n + g.presets.length, 0);
    const settings = games.reduce(
      (n, g) =>
        n +
        g.presets.reduce((m, p) => m + p.categories.reduce((k, c) => k + c.settings.length, 0), 0),
      0,
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${base}.${format}"`,
        "Cache-Control": "no-store",
        // What the file holds, for the "Recent exports" list in the browser.
        "X-Export-Counts": `${games.length},${presets},${settings}`,
      },
    });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: 404 });
    console.error("[csync:export]", error);
    return NextResponse.json({ error: "Export failed. Try again." }, { status: 500 });
  }
}
