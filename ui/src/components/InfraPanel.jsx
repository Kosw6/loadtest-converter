import React, { useState } from "react";

export default function InfraPanel({ infra, onChange, onClose }) {
  const [type, setType]       = useState(infra.type || "docker-compose");

  // docker-compose 전용
  const [nodes, setNodes]     = useState(infra.nodes || []);
  const [file, setFile]       = useState(infra.file || "");
  const [envFile, setEnvFile] = useState(infra.envFile || "");

  // terraform 전용
  const [dir, setDir]         = useState(infra.dir || "");
  const [outputs, setOutputs] = useState(
    infra.outputs
      ? Object.entries(infra.outputs).map(([k, v]) => ({ varName: k, outputKey: v }))
      : []
  );

  // ── docker-compose 노드 ──────────────────────────────────────────────────────
  function addNode() {
    setNodes((prev) => [...prev, { id: "", container: "" }]);
  }
  function updateNode(idx, key, val) {
    setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, [key]: val } : n));
  }
  function removeNode(idx) {
    setNodes((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── terraform outputs ────────────────────────────────────────────────────────
  function addOutput() {
    setOutputs((prev) => [...prev, { varName: "", outputKey: "" }]);
  }
  function updateOutput(idx, key, val) {
    setOutputs((prev) => prev.map((o, i) => i === idx ? { ...o, [key]: val } : o));
  }
  function removeOutput(idx) {
    setOutputs((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (type === "terraform") {
      const outputsMap = {};
      outputs.forEach(({ varName, outputKey }) => {
        if (varName && outputKey) outputsMap[varName] = outputKey;
      });
      onChange({ type, dir, outputs: outputsMap, file: "", envFile: "", nodes: [] });
    } else {
      onChange({ type, file, envFile, nodes, dir: "", outputs: {} });
    }
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
          {/* 타입 선택 */}
          <div className="infra-section">
            <div className="form-row">
              <label>인프라 타입</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="docker-compose">docker-compose</option>
                <option value="terraform">terraform</option>
              </select>
            </div>
          </div>

          {/* docker-compose 설정 */}
          {type === "docker-compose" && (
            <>
              <div className="infra-section">
                <div className="infra-section-title">Docker Compose</div>
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

              <div className="infra-section">
                <div className="infra-section-title">
                  노드 등록
                  <span className="infra-hint">chaos step에서 target으로 참조합니다</span>
                </div>
                {nodes.length === 0 && <p className="hint">등록된 노드가 없습니다.</p>}
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
            </>
          )}

          {/* terraform 설정 */}
          {type === "terraform" && (
            <>
              <div className="infra-section">
                <div className="infra-section-title">Terraform</div>
                <div className="form-row">
                  <label>terraform 디렉토리</label>
                  <input
                    value={dir}
                    onChange={(e) => setDir(e.target.value)}
                    placeholder="/home/user/infra 또는 C:/Users/.../terraform-test"
                  />
                </div>
              </div>

              <div className="infra-section">
                <div className="infra-section-title">
                  Output 변수 매핑
                  <span className="infra-hint">
                    step의 base_url 등에서 {'${변수명}'}으로 참조합니다
                  </span>
                </div>
                {outputs.length === 0 && <p className="hint">등록된 매핑이 없습니다.</p>}
                {outputs.map((o, idx) => (
                  <div key={idx} className="infra-node-row">
                    <input
                      className="infra-node-id"
                      value={o.varName}
                      onChange={(e) => updateOutput(idx, "varName", e.target.value)}
                      placeholder="변수명 (예: app_url)"
                    />
                    <span className="infra-node-arrow">→</span>
                    <input
                      className="infra-node-container"
                      value={o.outputKey}
                      onChange={(e) => updateOutput(idx, "outputKey", e.target.value)}
                      placeholder="terraform output 키 (예: app_public_ip)"
                    />
                    <button className="btn-icon" onClick={() => removeOutput(idx)}>🗑</button>
                  </div>
                ))}
                <button className="btn-ghost infra-add-node" onClick={addOutput}>
                  + 매핑 추가
                </button>
              </div>
            </>
          )}

          {/* YAML 미리보기 */}
          <div className="infra-section">
            <div className="infra-section-title">YAML 미리보기</div>
            <pre className="infra-preview">
              {buildPreview({ type, file, envFile, nodes, dir, outputs })}
            </pre>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

function buildPreview({ type, file, envFile, nodes, dir, outputs }) {
  const lines = ["infra:"];
  lines.push(`  type: ${type}`);

  if (type === "terraform") {
    if (dir) lines.push(`  dir: ${dir}`);
    if (outputs.length > 0) {
      lines.push("  outputs:");
      outputs.forEach(({ varName, outputKey }) => {
        if (varName && outputKey) lines.push(`    ${varName}: ${outputKey}`);
      });
    }
  } else {
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
  }

  return lines.join("\n");
}
