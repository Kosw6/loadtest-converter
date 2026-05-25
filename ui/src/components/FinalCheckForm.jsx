import React, { useState } from "react";
import KVEditor from "./KVEditor.jsx";
import Tooltip from "./Tooltip.jsx";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function newCheck() {
  return {
    id: "",
    method: "GET",
    path: "",
    headers: {},
    body: {},
    assert: { status: 200, json: {} },
  };
}

export default function FinalCheckForm({ checks: checksProp, onChange }) {
  const checks = checksProp || [];
  const [openIdx, setOpenIdx] = useState(null);

  const update = (idx, key, val) => {
    const next = checks.map((c, i) => (i === idx ? { ...c, [key]: val } : c));
    onChange(next);
  };

  const updateAssert = (idx, key, val) => {
    const next = checks.map((c, i) =>
      i === idx ? { ...c, assert: { ...c.assert, [key]: val } } : c
    );
    onChange(next);
  };

  const add = () => {
    onChange([...checks, newCheck()]);
    setOpenIdx(checks.length);
  };

  const remove = (idx) => {
    onChange(checks.filter((_, i) => i !== idx));
    setOpenIdx(null);
  };

  return (
    <div className="action-list">
      {checks.map((c, idx) => (
        <div key={idx} className="action-card">
          <div
            className="action-header"
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
          >
            <span className={`method-badge method-${c.method.toLowerCase()}`}>
              {c.method}
            </span>
            <span className="action-path">{c.path || "(path 없음)"}</span>
            <span className="action-name">{c.id && `[${c.id}]`}</span>
            <button
              className="btn-icon ml-auto"
              onClick={(e) => { e.stopPropagation(); remove(idx); }}
            >
              🗑
            </button>
          </div>

          {openIdx === idx && (
            <div className="action-body">
              <div className="form-row">
                <label>
                  ID
                  <Tooltip text={"이 check의 식별자. 결과 JSON과 report.md에 표시됩니다.\n예: check-order-count"} />
                </label>
                <input
                  value={c.id}
                  onChange={(e) => update(idx, "id", e.target.value)}
                  placeholder="check-id"
                />
              </div>
              <div className="form-row">
                <label>Method</label>
                <select value={c.method} onChange={(e) => update(idx, "method", e.target.value)}>
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>
                  Path
                  <Tooltip text={"검증할 API 경로. Base URL 뒤에 붙습니다.\n예: /api/orders/count"} />
                </label>
                <input
                  value={c.path}
                  onChange={(e) => update(idx, "path", e.target.value)}
                  placeholder="/api/resource"
                />
              </div>
              <KVEditor
                label="Headers"
                value={c.headers}
                onChange={(v) => update(idx, "headers", v)}
              />
              <div className="form-row col">
                <label>Body (JSON)</label>
                <textarea
                  rows={3}
                  value={JSON.stringify(c.body, null, 2)}
                  onChange={(e) => {
                    try { update(idx, "body", JSON.parse(e.target.value)); } catch (_) {}
                  }}
                />
              </div>

              {/* Assert */}
              <div className="section-divider" style={{ fontSize: "0.8rem" }}>
                Assert
                <Tooltip text={"k6 완료 후 Go 엔진이 직접 응답을 검증합니다.\n실패한 항목은 report.md에 상세 출력됩니다."} />
              </div>
              <div className="form-row">
                <label>
                  기대 Status
                  <Tooltip text={"기대하는 HTTP 상태코드.\n0으로 설정하면 status 검증을 생략합니다."} />
                </label>
                <input
                  type="number"
                  value={c.assert.status}
                  min={0}
                  onChange={(e) => updateAssert(idx, "status", Number(e.target.value))}
                  placeholder="200"
                />
              </div>
              <KVEditor
                label="JSON Assert (경로 → 기대값)"
                value={c.assert.json || {}}
                onChange={(v) => updateAssert(idx, "json", v)}
              />
              <p className="hint">
                기대값 종류: <code>exists</code> · <code>not_exists</code> · 직접 값 비교<br />
                예: <code>$.data.count</code> → <code>100</code> &nbsp;(부하 후 주문이 정확히 100건인지 검증)
              </p>
            </div>
          )}
        </div>
      ))}
      <button className="btn-ghost" onClick={add}>+ Check 추가</button>
    </div>
  );
}
