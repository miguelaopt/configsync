import { spawn } from "node:child_process";
import { AppError } from "@/lib/data/errors";
import type {
  ProposedSetting,
  ScreenshotHints,
  ScreenshotImage,
  ScreenshotParser,
} from "./screenshot";

// Offline screenshot reader: the `tesseract` binary on this server, no image leaves it. It only
// recognises rows whose label is a known setting name or alias, and reads the text after it as
// the value. Checkboxes and sliders carry no text, so it skips them.
// ponytail: label-then-value on one line covers menus laid out as rows (CS2, Rocket League);
// a model is the upgrade for menus that aren't, and it's the default provider.

type Word = { text: string; left: number; top: number; height: number; conf: number };

const MAX_LABEL_WORDS = 6;
const MIN_WORD_CONF = 25;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** Strips the dropdown arrows, borders and focus rings OCR reads as `|v`, `[Fullscreen`, `3)`. */
const clean = (s: string) => {
  const t = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
  return t !== s && t.length <= 1 ? "" : t;
};

function parseTsv(tsv: string): Word[] {
  const words: Word[] = [];
  for (const line of tsv.split("\n").slice(1)) {
    const c = line.split("\t");
    if (c.length < 12) continue;
    const text = c[11]!.trim();
    const conf = Number(c[10]);
    if (!text || conf < MIN_WORD_CONF) continue;
    words.push({ text, left: +c[6]!, top: +c[7]!, height: +c[9]!, conf });
  }
  return words;
}

/** Words on one visual line, left to right. */
function rows(words: Word[]): Word[][] {
  const mid = (w: Word) => w.top + w.height / 2;
  const sorted = [...words].sort((a, b) => mid(a) - mid(b));
  const out: Word[][] = [];
  for (const w of sorted) {
    const row = out.at(-1);
    if (row && Math.abs(mid(w) - mid(row[0]!)) <= Math.max(row[0]!.height, w.height) * 0.6)
      row.push(w);
    else out.push([w]);
  }
  return out.map((r) => r.sort((a, b) => a.left - b.left));
}

export function proposalsFromTsv(tsv: string, hints: ScreenshotHints): ProposedSetting[] {
  const byName = new Map<string, ScreenshotHints["tracked"][number]>();
  // Menu first so a setting already in the preset wins the name.
  for (const h of [...hints.menu, ...hints.tracked])
    for (const n of [h.name, ...(h.aliases ?? [])]) byName.set(norm(n), h);

  const out: ProposedSetting[] = [];
  for (const row of rows(parseTsv(tsv))) {
    // Longest run of words starting at i that is a known name.
    const labelAt = (i: number) => {
      for (let k = Math.min(MAX_LABEL_WORDS, row.length - i); k > 0; k--) {
        const hint = byName.get(
          norm(
            row
              .slice(i, i + k)
              .map((w) => w.text)
              .join(""),
          ),
        );
        if (hint) return { hint, k };
      }
      return null;
    };
    for (let i = 0; i < row.length;) {
      const label = labelAt(i);
      if (!label) {
        i++;
        continue;
      }
      let j = i + label.k;
      const value: Word[] = [];
      while (j < row.length && !labelAt(j)) value.push(row[j++]!);
      const text = value
        .map((w) => clean(w.text))
        .filter(Boolean)
        .join(" ");
      if (text)
        out.push({
          ref: label.hint.ref,
          name: row
            .slice(i, i + label.k)
            .map((w) => w.text)
            .join(" "),
          rawValue: text,
          category: label.hint.category,
          type: null,
          confidence: value.reduce((n, w) => n + w.conf, 0) / value.length / 100,
        });
      i = j;
    }
  }
  return out;
}

function tesseract(bin: string, image: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["stdin", "stdout", "--psm", "11", "-c", "tessedit_create_tsv=1"]);
    const chunks: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => child.kill(), 60_000);
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
      else reject(new Error(`tesseract exited ${code}: ${err.trim().slice(0, 300)}`));
    });
    child.stdin.end(image);
  });
}

export function createTesseractParser(bin = "tesseract"): ScreenshotParser {
  return {
    id: "tesseract",
    async parse(images: ScreenshotImage[], hints: ScreenshotHints) {
      const proposals: ProposedSetting[] = [];
      for (const image of images) {
        try {
          proposals.push(...proposalsFromTsv(await tesseract(bin, image.bytes), hints));
        } catch (e) {
          console.error("[csync:ocr]", e);
          throw new AppError("Couldn't read that screenshot. Try again in a moment.");
        }
      }
      return { proposals, usage: { inputTokens: 0, outputTokens: 0, model: "tesseract" } };
    },
  };
}
