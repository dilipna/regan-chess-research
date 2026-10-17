// How each topic connects to the rest of the curriculum. Derived from the data, never written by hand twice.

import { MAP_LINKS, MAP_NODES, TOPICS, topicBySlug } from "./index";
import type { Topic } from "./types";

export interface Connections {
  prev?: Topic; next?: Topic;
  requires: Topic[]; usedBy: Topic[];
  security: Topic[]; research: { href: string; label: string }[];
  crossLinks: string[];
}

const trackOrder = (t: Topic) => TOPICS.filter((x) => x.track === t.track);

export function connectionsOf(slug: string): Connections {
  const t = topicBySlug(slug);
  if (!t) return { requires: [], usedBy: [], security: [], research: [], crossLinks: [] };
  const order = trackOrder(t);
  const i = order.indexOf(t);
  const usedBy = TOPICS.filter((x) => x.prereqs.includes(slug));
  const security = t.track === "mastery"
    ? TOPICS.filter((x) => x.track === "security" && (x.prereqs.includes(slug) || x.links.some((l) => l.href.endsWith(`/${slug}`))))
    : TOPICS.filter((x) => x.track === "mastery" && t.prereqs.includes(x.slug));
  const research = [t.research, ...usedBy.map((u) => u.research)].filter((r): r is { href: string; label: string } => !!r)
    .filter((r, k, all) => all.findIndex((x) => x.href === r.href && x.label === r.label) === k);
  const myNodes = new Set(MAP_NODES.filter((n) => n.topic === slug).map((n) => n.id));
  const crossLinks = MAP_LINKS.filter((l) => myNodes.has(l.a) || myNodes.has(l.b)).map((l) => l.why);
  return { prev: order[i - 1], next: order[i + 1], requires: t.prereqs.map((p) => topicBySlug(p)!).filter(Boolean), usedBy, security, research, crossLinks };
}
