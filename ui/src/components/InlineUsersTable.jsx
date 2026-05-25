import React, { useState } from "react";

const FIXED_COLUMNS = ["id", "login_id", "password"];

function emptyRow() {
  return { id: "", login_id: "", password: "" };
}

export default function InlineUsersTable({ usersData, onChange }) {
  const [enabled, setEnabled] = useState(usersData.length > 0);
  const [mode, setMode] = useState("table"); // "table" | "json"
  const [jsonText, setJsonText] = useState(() => JSON.stringify(usersData, null, 2));
  const [jsonError, setJsonError] = useState("");

  const toggleEnabled = (val) => {
    setEnabled(val);
    if (!val) {
      onChange([]);
      setJsonText("[]");
    }
  };

  // ── 모드 전환 ──────────────────────────────────────────────
  const switchMode = (next) => {
    if (next === "json") {
      // 테이블 → JSON: 현재 usersData를 텍스트로 변환
      setJsonText(JSON.stringify(usersData, null, 2));
      setJsonError("");
    } else {
      // JSON → 테이블: 파싱 시도, 실패하면 유지
      try {
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed)) onChange(parsed);
      } catch (_) {}
    }
    setMode(next);
  };

  // ── 테이블 모드 ────────────────────────────────────────────
  const addRow = () => onChange([...usersData, emptyRow()]);
  const removeRow = (idx) => onChange(usersData.filter((_, i) => i !== idx));
  const setCell = (rIdx, col, val) =>
    onChange(usersData.map((r, i) => (i === rIdx ? { ...r, [col]: val } : r)));

  // ── JSON 모드 ──────────────────────────────────────────────
  const handleJsonChange = (text) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("배열이어야 합니다");
      onChange(parsed);
      setJsonError("");
    } catch (e) {
      setJsonError(e.message);
    }
  };

  return (
    <div className="inline-block">
      <div className="inline-block-header">
        <span className="inline-block-title">👤 Users 데이터 (이 step 전용)</span>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
          />
          <span>{enabled ? "직접 입력" : "사용 안 함"}</span>
        </label>
      </div>

      {!enabled && (
        <p className="hint">비활성 시 <code>../users.csv</code>를 참조합니다.</p>
      )}

      {enabled && (
        <>
          <div className="mode-tabs">
            <button
              className={`mode-tab ${mode === "table" ? "active" : ""}`}
              onClick={() => switchMode("table")}
            >
              테이블
            </button>
            <button
              className={`mode-tab ${mode === "json" ? "active" : ""}`}
              onClick={() => switchMode("json")}
            >
              JSON
            </button>
          </div>

          {mode === "table" && (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {FIXED_COLUMNS.map((c) => <th key={c}>{c}</th>)}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {FIXED_COLUMNS.map((c) => (
                          <td key={c}>
                            <input
                              value={row[c] || ""}
                              onChange={(e) => setCell(rIdx, c, e.target.value)}
                              placeholder={c}
                            />
                          </td>
                        ))}
                        <td>
                          <button className="btn-icon" onClick={() => removeRow(rIdx)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-ghost" onClick={addRow}>+ 행 추가</button>
            </>
          )}

          {mode === "json" && (
            <div className="form-row col">
              <textarea
                rows={7}
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='[{"id":"1","login_id":"user01","password":"pass1234"}]'
                className={jsonError ? "input-error" : ""}
              />
              {jsonError && <span className="error-msg">{jsonError}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
