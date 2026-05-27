import React from "react";
import { Handle, Position } from "@xyflow/react";

const TYPE_META = {
  k6:          { icon: "⚡", color: "#4c6ef5", label: "K6" },
  command:     { icon: "💻", color: "#3fb950", label: "CMD" },
  auth:        { icon: "🔐", color: "#e8a009", label: "AUTH" },
  final_check: { icon: "✅", color: "#56b3c4", label: "CHECK" },
  chaos:       { icon: "💥", color: "#f85149", label: "CHAOS" },
};

function StepSub({ step }) {
  const actionCount = step.actions?.length || 0;
  switch (step.type) {
    case "k6":
      return <span className="step-node-sub">{step.flow} · {actionCount} action{actionCount !== 1 ? "s" : ""}</span>;
    case "command":
      return <span className="step-node-sub" title={step.command}>{step.command ? step.command.slice(0, 22) + (step.command.length > 22 ? "…" : "") : "command"}</span>;
    case "auth":
      return <span className="step-node-sub">{step.baseUrl || "사전 로그인"}</span>;
    case "final_check": {
      const checkCount = step.checks?.length || 0;
      return <span className="step-node-sub">{checkCount} check{checkCount !== 1 ? "s" : ""}</span>;
    }
    case "chaos":
      return <span className="step-node-sub">{step.target ? `${step.target} · ${step.action || "stop"}` : "타겟 미설정"}</span>;
    default:
      return null;
  }
}

export default function StepNode({ data, selected }) {
  const { step } = data;
  const meta = TYPE_META[step.type] || TYPE_META.k6;

  return (
    <div className={`step-node ${selected ? "step-node--selected" : ""}`}
         style={{ "--node-color": meta.color }}>
      <Handle type="target" position={Position.Top} className="step-handle" />

      <div className="step-node-body">
        <div className="step-node-icon">{meta.icon}</div>
        <div className="step-node-info">
          <div className="step-node-name">{step.name || step.id || "unnamed"}</div>
          <div className="step-node-meta">
            <span className="step-node-badge" style={{ background: meta.color + "28", color: meta.color }}>
              {meta.label}
            </span>
            <StepSub step={step} />
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="step-handle" />
    </div>
  );
}
