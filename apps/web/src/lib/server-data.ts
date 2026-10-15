import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read exported JSON from public/ at build time; keys are the public URL paths used by useJson. */
export async function preload(urls: string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  await Promise.all(
    urls.map(async (u) => {
      try {
        out[u] = JSON.parse(await readFile(path.join(process.cwd(), "public", u), "utf-8"));
      } catch {
        /* missing file: the client falls back to fetching */
      }
    }),
  );
  return out;
}
