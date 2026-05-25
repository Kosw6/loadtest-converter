import React, { useRef, useState } from "react";
import { importScenario } from "../api/convertApi.js";

export default function ImportDialog({ onImport, onClose }) {
  const [yaml, setYaml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setYaml(ev.target.result);
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!yaml.trim()) {
      setError("YAML을 입력하거나 파일을 선택해주세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const req = await importScenario(yaml);
      onImport(req);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>📥 YAML 가져오기</h2>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="hint">
            기존 <code>scenario.yml</code> 내용을 붙여넣거나 파일을 선택하면 현재 시나리오를 덮어씁니다.<br />
            users.csv · params.json 데이터는 복원되지 않습니다.
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              📂 파일 선택
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".yml,.yaml"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            {yaml && (
              <button className="btn-ghost" onClick={() => setYaml("")}>
                지우기
              </button>
            )}
          </div>

          <textarea
            rows={16}
            style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            placeholder={"meta:\n  name: my-scenario\nsteps:\n  - id: step-1\n    ..."}
          />

          {error && (
            <p className="error-msg" style={{ whiteSpace: "pre-wrap" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={onClose}>취소</button>
            <button className="btn-primary" onClick={handleImport} disabled={loading}>
              {loading ? "가져오는 중..." : "가져오기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
