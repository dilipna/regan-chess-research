// Which diagram (if any) a topic shows under "B. Where it sits". Each diagram lives in its own file.

import { AttentionMaskDiagram } from "./attention-mask";
import { GqaLayoutDiagram } from "./gqa-layout";
import { MlpFlowDiagram } from "./mlp-flow";
import { QkvFlowDiagram } from "./qkv-flow";
import { ResidualStreamDiagram } from "./residual-stream";
import { RopeConceptDiagram } from "./rope-concept";

const BY_TOPIC: Record<string, () => React.ReactNode> = {
  qkv: () => <QkvFlowDiagram />,
  gqa: () => <GqaLayoutDiagram />,
  rope: () => <RopeConceptDiagram />,
  swiglu: () => <MlpFlowDiagram />,
  "causal-attention": () => <div className="grid gap-5"><QkvFlowDiagram /><AttentionMaskDiagram /></div>,
  "residual-stream": () => <ResidualStreamDiagram />,
  "residual-connections": () => <ResidualStreamDiagram />,
};

export function TopicDiagram({ slug }: { slug: string }) {
  const d = BY_TOPIC[slug];
  return d ? <div className="mt-3 rounded-lg border border-rule bg-paper-2/40 p-3 sm:p-4">{d()}</div> : null;
}
export const hasDiagram = (slug: string) => slug in BY_TOPIC;
