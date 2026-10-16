import { preload } from "@/lib/server-data";
import type { Architecture, ComponentProbe, GenerationSteps, LayerProbe, Metadata, Pending, PcaIndex, RecallPrecision, RmsnormProbe, StreamingCheck, TokenizerExamples, TokenTrace } from "./types";

export { BASE, MODEL_SLUG, PATHS } from "./paths";
import { PATHS } from "./paths";

export interface LearnData { arch: Architecture; tok: TokenizerExamples; trace: TokenTrace }
export interface ResearchData {
  arch: Architecture;
  layerProbe: LayerProbe | Pending;
  rmsnorm: RmsnormProbe | Pending;
  component: ComponentProbe | Pending;
  pca: PcaIndex | Pending;
  streaming?: StreamingCheck;
  metadata?: Metadata;
}

/** Server-side: read artifacts from public/ at build time. Missing research files are treated as pending. */
export async function loadLatent() {
  const d = await preload(Object.values(PATHS).filter((p) => p !== PATHS.recall && p !== PATHS.recallFp32));
  const pending = (what: string): Pending => ({ schema: what, status: "pending", model_id: "Qwen/Qwen3-8B-Base", reason: "Artifact file not found.", how_to_run: [] });
  return {
    arch: d[PATHS.architecture] as Architecture | undefined,
    tok: d[PATHS.tokenizer] as TokenizerExamples | undefined,
    trace: d[PATHS.trace] as TokenTrace | undefined,
    layerProbe: (d[PATHS.layerProbe] as LayerProbe | Pending | undefined) ?? pending("layer_probe"),
    rmsnorm: (d[PATHS.rmsnorm] as RmsnormProbe | Pending | undefined) ?? pending("rmsnorm_probe"),
    component: (d[PATHS.component] as ComponentProbe | Pending | undefined) ?? pending("component_probe"),
    pca: (d[PATHS.pca] as PcaIndex | Pending | undefined) ?? pending("pca"),
    streaming: d[PATHS.streaming] as StreamingCheck | undefined,
    recallPrecision: d[PATHS.recallPrecision] as RecallPrecision | undefined,
    generation: d[PATHS.generation] as GenerationSteps | undefined,
    metadata: d[PATHS.metadata] as Metadata | undefined,
  };
}
