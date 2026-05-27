import React, { useState } from "react";

export default function InfraFlowNode({ data, selected }) {
  const { node, onUpdate, onRemove } = data;
  const [editing, setEditing] = useState(!node.id && !node.container);
  const [id, setId]             = useState(node.id);
  const [container, setContainer] = useState(node.container);
  const [prevNode, setPrevNode] = useState(node);

  // 외부에서 node 데이터 바뀌면 동기화 (편집 중 아닐 때만)
  if (node !== prevNode && !editing) {
    setId(node.id);
    setContainer(node.container);
    setPrevNode(node);
  }

  function handleSave() {
    onUpdate({ id: id.trim(), container: container.trim() });
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter")  handleSave();
    if (e.key === "Escape") {
      setId(node.id);
      setContainer(node.container);
      setEditing(false);
    }
  }

  return (
    <div className={"infra-flow-node" + (selected ? " infra-flow-node--selected" : "")}>
      {editing ? (
        <div className="infra-flow-edit">
          <div className="infra-flow-edit-header">
            <span className="infra-flow-edit-title">🏗 Infra 노드</span>
          </div>
          <div className="infra-flow-edit-row">
            <span className="infra-flow-edit-label">ID</span>
            <input
              className="infra-flow-input nodrag nopan"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="redis, db, app-1"
              autoFocus
            />
          </div>
          <div className="infra-flow-edit-row">
            <span className="infra-flow-edit-label">컨테이너</span>
            <input
              className="infra-flow-input nodrag nopan"
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="컨테이너 이름"
            />
          </div>
          <div className="infra-flow-edit-btns">
            <button className="infra-btn-save nodrag" onClick={handleSave}>저장</button>
            <button
              className="infra-btn-cancel nodrag"
              onClick={() => {
                setId(node.id);
                setContainer(node.container);
                setEditing(false);
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="infra-flow-view">
          <div className="infra-flow-header">
            <span className="infra-flow-icon">🏗</span>
            <span className="infra-flow-badge">INFRA</span>
            <button
              className="infra-flow-delete nodrag"
              title="삭제"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              ✕
            </button>
          </div>
          <div
            className="infra-flow-body nodrag"
            title="클릭하여 편집"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            <div className="infra-flow-id">
              {node.id || <span className="infra-placeholder">id 없음</span>}
            </div>
            <div className="infra-flow-container-name">
              {node.container || <span className="infra-placeholder">컨테이너 없음</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
