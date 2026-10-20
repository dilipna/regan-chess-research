import type { Metadata } from "next";
import { MoveLens } from "@/components/movelens/movelens";
import { preload } from "@/lib/server-data";
import type { MLData, ReganChecks } from "@/lib/movelens";

export const metadata: Metadata = { title: "Phase 1 · Chess" };

export default async function ChessPhase() {
  const d = await preload(["/data/movelens_demo.json", "/data/regan_checks.json"]);
  const data = d["/data/movelens_demo.json"] as MLData | undefined;
  const checks = d["/data/regan_checks.json"] as ReganChecks | undefined;
  if (!data || !checks) return <main className="mx-auto max-w-3xl flex-1 px-4 py-24"><p role="alert" className="text-flag">The demo data files could not be loaded.</p></main>;
  return <MoveLens data={data} checks={checks} />;
}
