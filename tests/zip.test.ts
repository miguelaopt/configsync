import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { zipFiles } from "@/lib/import-export/zip";

describe("zipFiles", () => {
  it("writes a readable archive: headers, names, sizes and inflatable data", () => {
    const zip = zipFiles([
      { name: "a.json", data: '{"a":1}\n' },
      { name: "b.md", data: "# b\n" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    // end of central directory: entry count and where the directory starts
    const eocd = zip.length - 22;
    expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
    expect(zip.readUInt16LE(eocd + 10)).toBe(2);
    const dirOffset = zip.readUInt32LE(eocd + 16);
    expect(zip.readUInt32LE(dirOffset)).toBe(0x02014b50);
    expect(zip.subarray(dirOffset + 46, dirOffset + 52).toString()).toBe("a.json");
    // first entry's payload inflates back to the input
    const nameLen = zip.readUInt16LE(26);
    const packedLen = zip.readUInt32LE(18);
    const start = 30 + nameLen;
    expect(inflateRawSync(zip.subarray(start, start + packedLen)).toString()).toBe('{"a":1}\n');
  });
});
