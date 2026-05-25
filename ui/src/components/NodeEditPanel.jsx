import React from "react";
import StepCard from "./StepCard.jsx";

export default function NodeEditPanel({ step, allStepIds, onChange, onRemove, onClose }) {
  if (!step) {
    return (
      <div className="node-panel node-panel--empty">
        <p>노드를 클릭하면 여기에서 설정을 편집할 수 있습니다.</p>
        <p className="hint">핸들(●)을 드래그하면 연결선을 만들 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="node-panel">
      <div className="node-panel-header">
        <div className="node-panel-title">
          <span className={`step-type-badge type-${step.type}`}>{step.type.toUpperCase()}</span>
          <span>{step.name || step.id}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn-icon" title="삭제" onClick={onRemove}>🗑</button>
          <button className="btn-icon" title="닫기" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="node-panel-body">
        <StepCard
          step={step}
          allStepIds={allStepIds}
          onChange={onChange}
          onRemove={onRemove}
          panelMode
        />
      </div>
    </div>
  );
}
