import React, { useState, useEffect, useRef } from "react";

export default function InfraFlowNode({ data, selected }) {
  const { nodes, onAdd, onUpdate, onRemove } = data;

  const [editingIdx, setEditingIdx] = useState(null);
  const [editState, setEditState] = useState({ id: "", container: "" });
  const prevLenRef = useRef(nodes.length);

  // 새 항목이 추가되면 자동으로 편집 모드 진입
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
  }

  function handleSave(idx) {
    onUpdate(idx, { id: editState.id.trim(), container: editState.container.trim() });
    setEditingIdx(null);
  }

  function handleCancel(idx) {
    // 빈 상태로 취소 시 해당 항목 제거
    if (!nodes[idx]?.id && !nodes[idx]?.container) {
      onRemove(idx);
    }
    setEditingIdx(null);
  }

  function handleKeyDown(e, idx) {
    if (e.key === "Enter")  handleSave(idx);
    if (e.key === "Escape") handleCancel(idx);
  }

  return (
    <div className={"infra-flow-node" + (selected ? " infra-flow-node--selected" : "")}>
      {/* ── 헤더 ── */}
      <div className="infra-flow-header">
        <span className="infra-flow-icon">🏗</span>
        <span className="infra-flow-badge">INFRA</span>
        <button
          className="infra-flow-add-btn nodrag"
          title="노드 추가"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
          +
        </button>
      </div>

      {/* ── 빈 상태 ── */}
      {nodes.length === 0 && (
        <div className="infra-flow-empty">+ 버튼으로 노드를 추가하세요</div>
      )}

      {/* ── 항목 목록 ── */}
      {nodes.map((node, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <div className="infra-flow-divider" />}

          {editingIdx === idx ? (
            /* 편집 모드 */
            <div className="infra-flow-edit-body">
              <div className="infra-flow-edit-row">
                <span className="infra-flow-edit-label">ID</span>
                <input
                  className="infra-flow-input nodrag nopan"
                  value={editState.id}
                  onChange={(e) => setEditState((s) => ({ ...s, id: e.target.value }))}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  placeholder="redis, db, app-1"
                  autoFocus
                />
              </div>
              <div className="infra-flow-edit-row">
                <span className="infra-flow-edit-label">컨테이너</span>
                <input
                  className="infra-flow-input nodrag nopan"
                  value={editState.container}
                  onChange={(e) => setEditState((s) => ({ ...s, container: e.target.value }))}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  placeholder="컨테이너 이름"
                />
              </div>
              <div className="infra-flow-edit-btns">
                <button className="infra-btn-save nodrag" onClick={() => handleSave(idx)}>저장</button>
                <button className="infra-btn-cancel nodrag" onClick={() => handleCancel(idx)}>취소</button>
              </div>
            </div>
          ) : (
            /* 뷰 모드 */
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
                onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
              >
                ✕
              </button>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
