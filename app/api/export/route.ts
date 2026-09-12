import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { exportGame, exportLibrary, exportPreset } from "@/lib/data/export";
import { buildExportFile, toCsv, toJson, toMarkdown } from "@/lib/import-export/serialize";
import { AppError } from "@/lib/data/errors";
import { slugify } from "@/lib/utils/slug";

const query = z.object({
  scope: z.enum(["library", "game", "preset"]).default("library"),
  id: z.uuid().optional(),
  format: z.enum(["json", "md", "csv"]).default("json"),
  archived: z.enum(["1", "0"]).default("0"),
});

/** File downloads: /api/export?scope=library|game|preset&id=…&format=json|md|csv */
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
        ? `gamesettings-vault-library-${stamp}`
        : scope === "game"
          ? `${slugify(games[0]!.name)}-${stamp}`
          : `${slugify(games[0]!.name)}-${slugify(games[0]!.presets[0]?.name ?? "preset")}-${stamp}`;

    const body =
      format === "json"
        ? toJson(buildExportFile(games, scope))
        : format === "md"
          ? toMarkdown(games)
          : toCsv(games);
    const type =
      format === "json" ? "application/json" : format === "md" ? "text/markdown" : "text/csv";
    return new NextResponse(body, {
      headers: {
        "Content-Type": `${type}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${base}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: 404 });
    console.error("[gsv:export]", error);
    return NextResponse.json({ error: "Export failed. Try again." }, { status: 500 });
  }
}
