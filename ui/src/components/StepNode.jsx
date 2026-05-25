import React from "react";
import { Handle, Position } from "@xyflow/react";

const TYPE_META = {
  k6:      { icon: "⚡", color: "#4c6ef5", label: "K6" },
  command: { icon: "💻", color: "#3fb950", label: "CMD" },
};

export default function StepNode({ data, selected }) {
  const { step } = data;
  const meta = TYPE_META[step.type] || TYPE_META.k6;
  const actionCount = step.actions?.length || 0;

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
            {step.type === "k6" && (
              <span className="step-node-sub">
                {step.flow} · {actionCount} action{actionCount !== 1 ? "s" : ""}
              </span>
            )}
            {step.type === "command" && (
              <span className="step-node-sub">command</span>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="step-handle" />
    </div>
  );
}
