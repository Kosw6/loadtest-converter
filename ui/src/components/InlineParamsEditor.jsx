import React, { useState } from "react";
import KVEditor from "./KVEditor.jsx";

function emptyRow() {
  return {};
}

// paramsData: { rows: [...], perUser: {...} } | null
export default function InlineParamsEditor({ paramsData, mode, onChange }) {
  const [enabled, setEnabled] = useState(paramsData !== null);
  const [inputMode, setInputMode] = useState("kv"); // "kv" | "json"
  const [jsonText, setJsonText] = useState(() =>
    paramsData ? JSON.stringify(paramsData, null, 2) : ""
  );
  const [jsonError, setJsonError] = useState("");

  const rows = paramsData?.rows || [];
  const perUser = paramsData?.perUser || {};

  const toggleEnabled = (val) => {
    setEnabled(val);
    if (!val) {
      onChange(null);
      setJsonText("");
    } else {
      const init = { rows: [], perUser: {} };
      onChange(init);
      setJsonText(JSON.stringify(init, null, 2));
    }
  };

  // ── 모드 전환 ──────────────────────────────────────────────
  const switchInputMode = (next) => {
    if (next === "json") {
      setJsonText(JSON.stringify(paramsData || {}, null, 2));
      setJsonError("");
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        onChange(parsed);
      } catch (_) {}
    }
    setInputMode(next);
  };

  // ── KV 세트 모드 (rows) ────────────────────────────────────
  const addRow = () => onChange({ ...(paramsData || {}), rows: [...rows, emptyRow()] });
  const removeRow = (idx) =>
    onChange({ ...(paramsData || {}), rows: rows.filter((_, i) => i !== idx) });
  const updateRow = (idx, kv) =>
    onChange({ ...(paramsData || {}), rows: rows.map((r, i) => (i === idx ? kv : r)) });

  // per_user 모드: userId → rows 배열
  const getUserIds = () => Object.keys(perUser);
  const addUserId = () => {
    const uid = `user${getUserIds().length + 1}`;
    onChange({ ...(paramsData || {}), perUser: { ...perUser, [uid]: [{}] } });
  };
  const removeUserId = (uid) => {
    const next = { ...perUser };
    delete next[uid];
    onChange({ ...(paramsData || {}), perUser: next });
  };
  const updateUserRows = (uid, newRows) =>
    onChange({ ...(paramsData || {}), perUser: { ...perUser, [uid]: newRows } });
  const renameUserId = (oldUid, newUid) => {
    if (!newUid || newUid === oldUid) return;
    const next = {};
    Object.entries(perUser).forEach(([k, v]) => { next[k === oldUid ? newUid : k] = v; });
    onChange({ ...(paramsData || {}), perUser: next });
  };

  // ── JSON 모드 ──────────────────────────────────────────────
  const handleJsonChange = (text) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
      setJsonError("");
    } catch (e) {
      setJsonError(e.message);
    }
  };

  return (
    <div className="inline-block">
      <div className="inline-block-header">
        <span className="inline-block-title">📦 Params 데이터 (이 step 전용)</span>
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
        <p className="hint">비활성 시 params 파일을 생성하지 않습니다.</p>
      )}

      {enabled && (
        <>
          <div className="mode-tabs">
            <button
              className={`mode-tab ${inputMode === "kv" ? "active" : ""}`}
              onClick={() => switchInputMode("kv")}
            >
              KV 세트
            </button>
            <button
              className={`mode-tab ${inputMode === "json" ? "active" : ""}`}
              onClick={() => switchInputMode("json")}
            >
              JSON
            </button>
          </div>

          {inputMode === "kv" && mode !== "per_user" && (
            <div className="kv-set-list">
              {rows.map((row, idx) => (
                <div key={idx} className="kv-set-row">
                  <div className="kv-set-row-header">
                    <span className="kv-set-row-label">행 {idx + 1}</span>
                    <button className="btn-icon" onClick={() => removeRow(idx)}>🗑</button>
                  </div>
                  <KVEditor value={row} onChange={(kv) => updateRow(idx, kv)} />
                </div>
              ))}
              <button className="btn-ghost" onClick={addRow}>+ 행 추가</button>
            </div>
          )}

          {inputMode === "kv" && mode === "per_user" && (
            <div className="kv-set-list">
              {getUserIds().map((uid) => (
                <div key={uid} className="kv-set-row">
                  <div className="kv-set-row-header">
                    <input
                      className="uid-input"
                      value={uid}
                      onBlur={(e) => renameUserId(uid, e.target.value)}
                      onChange={() => {}}
                      placeholder="userId"
                    />
                    <button className="btn-icon" onClick={() => removeUserId(uid)}>🗑</button>
                  </div>
                  {(perUser[uid] || []).map((row, rIdx) => (
                    <div key={rIdx} className="kv-set-subrow">
                      <KVEditor
                        value={row}
                        onChange={(kv) => {
                          const next = [...(perUser[uid] || [])];
                          next[rIdx] = kv;
                          updateUserRows(uid, next);
                        }}
                      />
                      <button
                        className="btn-icon"
                        onClick={() => updateUserRows(uid, (perUser[uid] || []).filter((_, i) => i !== rIdx))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn-ghost"
                    onClick={() => updateUserRows(uid, [...(perUser[uid] || []), {}])}
                  >
                    + 행
                  </button>
                </div>
              ))}
              <button className="btn-ghost" onClick={addUserId}>+ 유저 추가</button>
            </div>
          )}

          {inputMode === "json" && (
            <div className="form-row col">
              <textarea
                rows={8}
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder={
                  mode === "per_user"
                    ? '{"perUser":{"userId1":[{"key":"value"}]}}'
                    : '{"rows":[{"key":"value"}]}'
                }
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
