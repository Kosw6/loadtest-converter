import React, { useState } from "react";
import KVEditor from "./KVEditor.jsx";
import Tooltip from "./Tooltip.jsx";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function newAction() {
  return {
    id: "",
    name: "",
    method: "GET",
    path: "",
    weight: 100,
    headers: { "Content-Type": "application/json" },
    query: {},
    body: {},
    extract: { json: {}, header: {}, cookie: {} },
    assert: { status: 0, json: {} },
  };
}

export default function ActionForm({ actions: actionsProp, onChange, showWeight }) {
  const actions = actionsProp || [];
  const [openIdx, setOpenIdx] = useState(null);

  const update = (idx, key, val) => {
    const next = actions.map((a, i) => (i === idx ? { ...a, [key]: val } : a));
    onChange(next);
  };

  const updateExtract = (idx, key, val) => {
    const next = actions.map((a, i) =>
      i === idx ? { ...a, extract: { ...a.extract, [key]: val } } : a
    );
    onChange(next);
  };

  const updateAssert = (idx, key, val) => {
    const next = actions.map((a, i) =>
      i === idx ? { ...a, assert: { ...a.assert, [key]: val } } : a
    );
    onChange(next);
  };

  const add = () => {
    onChange([...actions, newAction()]);
    setOpenIdx(actions.length);
  };

  const remove = (idx) => {
    onChange(actions.filter((_, i) => i !== idx));
    setOpenIdx(null);
  };

  return (
    <div className="action-list">
      {actions.map((a, idx) => (
        <div key={idx} className="action-card">
          <div
            className="action-header"
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
          >
            <span className={`method-badge method-${a.method.toLowerCase()}`}>
              {a.method}
            </span>
            <span className="action-path">{a.path || "(path 없음)"}</span>
            <span className="action-name">{a.name && `[${a.name}]`}</span>
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
                  <Tooltip text={"이 action의 식별자. k6 check 레이블과 로그에서 사용됩니다.\n예: create-order"} />
                </label>
                <input value={a.id} onChange={(e) => update(idx, "id", e.target.value)} placeholder="action-id" />
              </div>
              <div className="form-row">
                <label>Name</label>
                <input value={a.name} onChange={(e) => update(idx, "name", e.target.value)} placeholder="표시 이름" />
              </div>
              <div className="form-row">
                <label>Method</label>
                <select value={a.method} onChange={(e) => update(idx, "method", e.target.value)}>
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>
                  Path
                  <Tooltip text={"URL 경로. 아래 변수를 사용할 수 있습니다.\n{{user.컬럼}} — users.csv 값\n{{param.컬럼}} — params 값\n{{context.키}} — 이전 action의 extract 값"} />
                </label>
                <input value={a.path} onChange={(e) => update(idx, "path", e.target.value)} placeholder="/api/resource/{{context.id}}" />
              </div>
              {showWeight && (
                <div className="form-row">
                  <label>
                    Weight
                    <Tooltip text={"weighted flow에서 이 action이 선택될 상대적 비율.\n예: A=70, B=30 → A가 70% 확률로 선택"} />
                  </label>
                  <input
                    type="number"
                    value={a.weight}
                    min={1}
                    onChange={(e) => update(idx, "weight", Number(e.target.value))}
                  />
                </div>
              )}
              <KVEditor
                label="Headers"
                value={a.headers}
                onChange={(v) => update(idx, "headers", v)}
              />
              <KVEditor
                label="Query"
                value={a.query}
                onChange={(v) => update(idx, "query", v)}
              />
              <div className="form-row col">
                <label>Body (JSON)</label>
                <textarea
                  rows={4}
                  value={JSON.stringify(a.body, null, 2)}
                  onChange={(e) => {
                    try { update(idx, "body", JSON.parse(e.target.value)); } catch (_) {}
                  }}
                />
              </div>

              {/* Extract */}
              <div className="section-divider" style={{ fontSize: "0.8rem" }}>
                Extract
                <Tooltip text={"응답에서 값을 추출해 다음 action에서 {{context.키}} 로 사용합니다.\n순서: action A 실행 → 값 추출 → action B path/body에서 참조"} />
              </div>
              <KVEditor
                label="JSON (경로 → context 키)"
                value={a.extract?.json || {}}
                onChange={(v) => updateExtract(idx, "json", v)}
              />
              <p className="hint">예: <code>$.data.id</code> → <code>orderId</code> &nbsp;→&nbsp; 다음 action path에서 <code>{"{{context.orderId}}"}</code> 로 참조</p>
              <KVEditor
                label="Header (헤더명 → context 키)"
                value={a.extract?.header || {}}
                onChange={(v) => updateExtract(idx, "header", v)}
              />
              <p className="hint">예: <code>Location</code> → <code>redirectUrl</code></p>
              <KVEditor
                label="Cookie (쿠키명 → context 키)"
                value={a.extract?.cookie || {}}
                onChange={(v) => updateExtract(idx, "cookie", v)}
              />
              <p className="hint">예: <code>JSESSIONID</code> → <code>session</code></p>

              {/* Assert */}
              <div className="section-divider" style={{ fontSize: "0.8rem" }}>
                Assert
                <Tooltip text={"응답이 기대 조건을 만족하는지 k6 check로 검증합니다.\n실패 시 check fail 카운트에 집계됩니다."} />
              </div>
              <div className="form-row">
                <label>
                  기대 Status
                  <Tooltip text={"기대하는 HTTP 상태코드.\n0으로 설정하면 status 검증을 생략합니다."} />
                </label>
                <input
                  type="number"
                  value={a.assert?.status || 0}
                  min={0}
                  onChange={(e) => updateAssert(idx, "status", Number(e.target.value))}
                />
              </div>
              <KVEditor
                label="JSON Assert (경로 → 기대값)"
                value={a.assert?.json || {}}
                onChange={(v) => updateAssert(idx, "json", v)}
              />
              <p className="hint">
                기대값 종류: <code>exists</code> (존재 확인) · <code>not_exists</code> (없음 확인) · 직접 값 비교<br />
                예: <code>$.data.status</code> → <code>APPROVED</code> &nbsp;/&nbsp; <code>$.data.id</code> → <code>exists</code>
              </p>
            </div>
          )}
        </div>
      ))}
      <button className="btn-ghost" onClick={add}>+ Action 추가</button>
    </div>
  );
}
