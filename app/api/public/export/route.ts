import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicPreset } from "@/lib/data/public";
import { buildExportFile, toJson } from "@/lib/import-export/serialize";
import { slugify } from "@/lib/utils/slug";

const query = z.object({
  u: z.string().min(1).max(32),
  g: z.string().min(1).max(120),
  p: z.string().min(1).max(120),
});

/** JSON download of a public preset: /api/public/export?u=<username>&g=<game>&p=<preset> */
export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  const pub = await getPublicPreset(parsed.data.u, parsed.data.g, parsed.data.p);
  if (!pub) return new NextResponse(null, { status: 404 });
  const file = buildExportFile([pub.doc], "preset");
  return new NextResponse(toJson(file), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="configsync-${slugify(pub.game.name)}-${pub.preset.slug}.json"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
