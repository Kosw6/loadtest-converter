import React, { useState } from "react";

export default function InfraPanel({ infra, onChange, onClose }) {
  const [nodes, setNodes] = useState(infra.nodes || []);
  const [type, setType]     = useState(infra.type || "docker-compose");
  const [file, setFile]     = useState(infra.file || "");
  const [envFile, setEnvFile] = useState(infra.envFile || "");

  function addNode() {
    setNodes((prev) => [...prev, { id: "", container: "" }]);
  }

  function updateNode(idx, key, val) {
    setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, [key]: val } : n));
  }

  function removeNode(idx) {
    setNodes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    onChange({ type, file, envFile, nodes });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box infra-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🏗 인프라 세팅</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* docker-compose 설정 */}
          <div className="infra-section">
            <div className="infra-section-title">Docker Compose</div>
            <div className="form-row">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="docker-compose">docker-compose</option>
              </select>
            </div>
            <div className="form-row">
              <label>Compose 파일 경로</label>
              <input
                value={file}
                onChange={(e) => setFile(e.target.value)}
                placeholder="./docker-compose.yml"
              />
            </div>
            <div className="form-row">
              <label>Env 파일 경로 <span className="optional">(선택)</span></label>
              <input
                value={envFile}
                onChange={(e) => setEnvFile(e.target.value)}
                placeholder=".env.runtime"
              />
            </div>
          </div>

          {/* 노드 목록 */}
          <div className="infra-section">
            <div className="infra-section-title">
              노드 등록
              <span className="infra-hint">chaos step에서 target으로 참조합니다</span>
            </div>

            {nodes.length === 0 && (
              <p className="hint">등록된 노드가 없습니다.</p>
            )}

            {nodes.map((node, idx) => (
              <div key={idx} className="infra-node-row">
                <input
                  className="infra-node-id"
                  value={node.id}
                  onChange={(e) => updateNode(idx, "id", e.target.value)}
                  placeholder="논리 이름 (redis, db, app-1)"
                />
                <span className="infra-node-arrow">→</span>
                <input
                  className="infra-node-container"
                  value={node.container}
                  onChange={(e) => updateNode(idx, "container", e.target.value)}
                  placeholder="컨테이너 이름"
                />
                <button className="btn-icon" onClick={() => removeNode(idx)}>🗑</button>
              </div>
            ))}

            <button className="btn-ghost infra-add-node" onClick={addNode}>
              + 노드 추가
            </button>
          </div>

          {/* 미리보기 */}
          {nodes.length > 0 && (
            <div className="infra-section">
              <div className="infra-section-title">YAML 미리보기</div>
              <pre className="infra-preview">{buildPreview({ type, file, envFile, nodes })}</pre>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

function buildPreview({ type, file, envFile, nodes }) {
  const lines = ["infra:"];
  if (type) lines.push(`  type: ${type}`);
  if (file) lines.push(`  file: ${file}`);
  if (envFile) lines.push(`  env_file: ${envFile}`);
  if (nodes.length > 0) {
    lines.push("  nodes:");
    nodes.forEach((n) => {
      if (n.id || n.container) {
        lines.push(`    - id: ${n.id}`);
        lines.push(`      container: ${n.container}`);
      }
    });
  }
  return lines.join("\n");
}
