import React, { useState, useEffect, useRef } from "react";

export default function InfraFlowNode({ data, selected }) {
  const {
    infra,
    onSetType,
    onSetDir,
    // docker-compose nodes
    onAddNode, onUpdateNode, onRemoveNode,
    // terraform outputs
    onAddOutput, onUpdateOutput, onRemoveOutput,
  } = data;

  const type = infra?.type || "docker-compose";
  const nodes = infra?.nodes || [];
  // outputs(object) → 편집용 배열로 변환
  const outputs = Object.entries(infra?.outputs || {}).map(([varName, outputKey]) => ({ varName, outputKey }));

  const [editingIdx, setEditingIdx] = useState(null);
  const [editState, setEditState] = useState({ id: "", container: "" });
  const [errors, setErrors] = useState({});
  const prevLenRef = useRef(nodes.length);

  // 새 노드 추가 시 자동 편집 모드
  useEffect(() => {
    if (nodes.length > prevLenRef.current) {
      const newIdx = nodes.length - 1;
      if (!nodes[newIdx].id && !nodes[newIdx].container) {
        setEditingIdx(newIdx);
        setEditState({ id: "", container: "" });
      }
    }
    prevLenRef.current = nodes.length;
  }, [nodes.length]);

  function startEdit(idx) {
    setEditingIdx(idx);
    setEditState({ id: nodes[idx].id, container: nodes[idx].container });
    setErrors({});
  }

  function handleSave(idx) {
    const id = editState.id.trim();
    const container = editState.container.trim();
    const newErrors = {};
    if (!id) newErrors.id = "ID는 필수입니다";
    if (!container) newErrors.container = "컨테이너 명은 필수입니다";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onUpdateNode(idx, { id, container });
    setEditingIdx(null);
  }

  function handleCancel(idx) {
    setErrors({});
    if (!nodes[idx]?.id && !nodes[idx]?.container) {
      onRemoveNode(idx);
    }
    setEditingIdx(null);
  }

  function handleKeyDown(e, idx) {
    if (e.key === "Enter") handleSave(idx);
    if (e.key === "Escape") handleCancel(idx);
  }

  return (
    <div className={"infra-flow-node" + (selected ? " infra-flow-node--selected" : "")}>
      {/* ── 헤더 ── */}
      <div className="infra-flow-header">
        <span className="infra-flow-icon">🏗</span>
        <span className="infra-flow-badge">INFRA</span>
        {type === "docker-compose" && (
          <button
            className="infra-flow-add-btn nodrag"
            title="노드 추가"
            onClick={(e) => { e.stopPropagation(); onAddNode(); }}
          >
            +
          </button>
        )}
      </div>

      {/* ── 타입 선택 ── */}
      <div className="infra-flow-type-row nodrag">
        <span className="infra-flow-edit-label">Type</span>
        <select
          className="infra-flow-input nodrag nopan"
          value={type}
          onChange={(e) => { e.stopPropagation(); onSetType(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="docker-compose">docker-compose</option>
          <option value="terraform">terraform</option>
        </select>
      </div>

      {/* ── docker-compose: 노드 목록 ── */}
      {type === "docker-compose" && (
        <>
          {nodes.length === 0 && (
            <div className="infra-flow-empty">+ 버튼으로 노드를 추가하세요</div>
          )}
          {nodes.map((node, idx) => (
            <React.Fragment key={idx}>
              {idx >= 0 && <div className="infra-flow-divider" />}
              {editingIdx === idx ? (
                <div className="infra-flow-edit-body">
                  <div className="infra-flow-edit-row">
                    <span className="infra-flow-edit-label">
                      ID <span className="infra-required">*</span>
                    </span>
                    <div className="infra-flow-input-wrap">
                      <input
                        className={"infra-flow-input nodrag nopan" + (errors.id ? " infra-flow-input--error" : "")}
                        value={editState.id}
                        onChange={(e) => { setEditState((s) => ({ ...s, id: e.target.value })); setErrors((er) => ({ ...er, id: undefined })); }}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        placeholder="redis, db, app-1"
                        autoFocus
                      />
                      {errors.id && <span className="infra-error-msg">{errors.id}</span>}
                    </div>
                  </div>
                  <div className="infra-flow-edit-row">
                    <span className="infra-flow-edit-label">
                      컨테이너 <span className="infra-required">*</span>
                    </span>
                    <div className="infra-flow-input-wrap">
                      <input
                        className={"infra-flow-input nodrag nopan" + (errors.container ? " infra-flow-input--error" : "")}
                        value={editState.container}
                        onChange={(e) => { setEditState((s) => ({ ...s, container: e.target.value })); setErrors((er) => ({ ...er, container: undefined })); }}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        placeholder="컨테이너 이름"
                      />
                      {errors.container && <span className="infra-error-msg">{errors.container}</span>}
                    </div>
                  </div>
                  <div className="infra-flow-edit-btns">
                    <button className="infra-btn-save nodrag" onClick={() => handleSave(idx)}>저장</button>
                    <button className="infra-btn-cancel nodrag" onClick={() => handleCancel(idx)}>취소</button>
                  </div>
                </div>
              ) : (
                <div
                  className="infra-flow-entry nodrag"
                  title="클릭하여 편집"
                  onClick={(e) => { e.stopPropagation(); startEdit(idx); }}
                >
                  <div className="infra-flow-entry-info">
                    <div className="infra-flow-id">
                      {node.id || <span className="infra-placeholder">id 없음</span>}
                    </div>
                    <div className="infra-flow-container-name">
                      {node.container || <span className="infra-placeholder">컨테이너 없음</span>}
                    </div>
                  </div>
                  <button
                    className="infra-flow-delete nodrag"
                    title="삭제"
                    onClick={(e) => { e.stopPropagation(); onRemoveNode(idx); }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </React.Fragment>
          ))}
        </>
      )}

      {/* ── terraform: dir + outputs ── */}
      {type === "terraform" && (
        <>
          <div className="infra-flow-divider" />
          <div className="infra-flow-edit-row">
            <span className="infra-flow-edit-label">dir</span>
            <input
              className="infra-flow-input nodrag nopan"
              value={infra?.dir || ""}
              onChange={(e) => { e.stopPropagation(); onSetDir(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              placeholder="C:/.../terraform-test"
            />
          </div>

          <div className="infra-flow-divider" />
          <div className="infra-flow-outputs-header">
            <span className="infra-flow-edit-label">outputs</span>
            <button
              className="infra-flow-add-btn nodrag"
              title="output 매핑 추가"
              onClick={(e) => { e.stopPropagation(); onAddOutput(); }}
            >
              +
            </button>
          </div>
          <div className="infra-flow-hint">
            {"${변수명} → terraform output 키"}
          </div>

          {outputs.length === 0 && (
            <div className="infra-flow-empty">+ 로 매핑을 추가하세요</div>
          )}
          {outputs.map((o, idx) => (
            <div key={idx} className="infra-flow-output-row nodrag">
              <input
                className="infra-flow-input infra-flow-input--sm nodrag nopan"
                value={o.varName}
                onChange={(e) => { e.stopPropagation(); onUpdateOutput(idx, "varName", e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                placeholder="app_url"
              />
              <span className="infra-flow-arrow">→</span>
              <input
                className="infra-flow-input infra-flow-input--sm nodrag nopan"
                value={o.outputKey}
                onChange={(e) => { e.stopPropagation(); onUpdateOutput(idx, "outputKey", e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                placeholder="app_public_ip"
              />
              <button
                className="infra-flow-delete nodrag"
                title="삭제"
                onClick={(e) => { e.stopPropagation(); onRemoveOutput(idx); }}
              >
                ✕
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
