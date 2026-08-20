/** MindBuild Studio design reminder: concrete build stages, compact industrial labels, state changes lead visual hierarchy. */

import { Check, Circle, LoaderCircle, X } from "lucide-react";

type Stage = { label: string; state: "done" | "active" | "idle" | "error" };

export function BuildTimeline({ stages }: { stages: readonly Stage[] }) {
  return <ol className="build-timeline">{stages.map((stage, index) => <li className={`timeline-stage is-${stage.state}`} key={stage.label}>
    <span className="stage-dot">{stage.state === "done" ? <Check size={13} /> : stage.state === "active" ? <LoaderCircle size={14} className="spin" /> : stage.state === "error" ? <X size={14} /> : <Circle size={10} />}</span>
    <span className="stage-label">{stage.label}</span>
    {index < stages.length - 1 && <span className="stage-line" />}
  </li>)}</ol>;
}
