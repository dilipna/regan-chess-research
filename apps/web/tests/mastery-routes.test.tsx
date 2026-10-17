import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/mastery", notFound: () => { throw new Error("NOT_FOUND"); } }));

import MasteryHome from "@/app/latent/mastery/page";
import MasteryTopicPage, { generateStaticParams } from "@/app/latent/mastery/[topic]/page";
import LatentHome from "@/app/latent/page";
import { MasteryTopic } from "@/components/latent/mastery/mastery-topic";
import { connectionsOf } from "@/lib/latent/mastery/connections";
import { TOPICS } from "@/lib/latent/mastery";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const mastery = TOPICS.filter((t) => t.track === "mastery");

describe("/latent home", () => {
  it("shows the four paths, the progression and professor mode", async () => {
    const h = text(await LatentHome());
    for (const s of ["Understand modern AI from the inside out.", "Storybook", "Mastery", "Security", "Research", "Professor mode", "Intuition", "Mechanism", "System"]) expect(h).toContain(s);
  });
});

describe("/latent/mastery", () => {
  it("home renders the path, practice tools and the knowledge map", () => {
    const h = text(<MasteryHome />);
    for (const s of ["LLM Mastery", "Transformer foundations", "Interpretability and latent states", "I keep confusing these", "Follow one request end to end", "How it all connects", "Where am I?"]) expect(h).toContain(s);
  });
  it("generates exactly the mastery topics", () => {
    expect(generateStaticParams().map((p) => p.topic).sort()).toEqual(mastery.map((t) => t.slug).sort());
  });
  it("every topic renders the ten questions, all A-M layers and its connections", () => {
    for (const t of mastery) {
      const h = text(<MasteryTopic slug={t.slug} defaultOpen />);
      for (const s of ["The ten questions", "What enters?", "What shape changes?", "Exact mechanism", "Real Qwen connection", "Why it exists", "What breaks without it", "Training vs inference", "Security lens", "Common confusion", "Connections", "Teach it back", "Interview question", t.title]) expect(h, `${t.slug}: ${s}`).toContain(s);
    }
  });
  it("closed topics ask for a prediction first", () => {
    expect(text(<MasteryTopic slug="rmsnorm" />)).toContain("Predict before you read");
  });
  it("rejects unknown and security slugs", async () => {
    await expect(MasteryTopicPage({ params: Promise.resolve({ topic: "nope" }) })).rejects.toThrow("NOT_FOUND");
    await expect(MasteryTopicPage({ params: Promise.resolve({ topic: "prompt-injection" }) })).rejects.toThrow("NOT_FOUND");
  });
  it("connections are derived from the data", () => {
    const c = connectionsOf("gqa");
    expect(c.requires.map((t) => t.slug)).toContain("qkv");
    expect(c.usedBy.map((t) => t.slug)).toEqual(expect.arrayContaining(["causal-attention", "prefill-decode"]));
    expect(connectionsOf("rag").security.map((t) => t.slug)).toEqual(expect.arrayContaining(["rag-security"]));
    expect(connectionsOf("autoregressive").prev).toBeUndefined();
    expect(connectionsOf("decoding").next?.slug).toBe("pretraining-data");
  });
});
