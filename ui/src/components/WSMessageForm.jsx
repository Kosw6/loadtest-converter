import React from "react";
import Tooltip from "./Tooltip.jsx";

const VALUE_TYPES = [
  { value: "fixed",     label: "고정값" },
  { value: "randomInt", label: "랜덤 정수" },
  { value: "now",       label: "현재 시각" },
  { value: "param",     label: "params 값" },
];

function emptyField() {
  return { key: "", valueType: "fixed", fixed: "", min: 0, max: 100, paramKey: "" };
}

function emptyMessage() {
  return { type: "CURSOR", interval: 1000, body: [emptyField()] };
}

function BodyFieldRow({ field, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...field, [k]: v });

  return (
    <tr>
      <td>
        <input
          className="ws-body-input"
          placeholder="key"
          value={field.key}
          onChange={(e) => set("key", e.target.value)}
        />
      </td>
      <td>
        <select
          className="ws-body-select"
          value={field.valueType}
          onChange={(e) => set("valueType", e.target.value)}
        >
          {VALUE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </td>
      <td>
        {field.valueType === "fixed" && (
          <input
            className="ws-body-input"
            placeholder="값"
            value={field.fixed}
            onChange={(e) => set("fixed", e.target.value)}
          />
        )}
        {field.valueType === "randomInt" && (
          <div className="ws-range-row">
            <input
              className="ws-body-input ws-body-input--num"
              type="number"
              placeholder="min"
              value={field.min}
              onChange={(e) => set("min", Number(e.target.value))}
            />
            <span className="ws-range-sep">~</span>
            <input
              className="ws-body-input ws-body-input--num"
              type="number"
              placeholder="max"
              value={field.max}
              onChange={(e) => set("max", Number(e.target.value))}
            />
          </div>
        )}
        {field.valueType === "now" && (
          <span className="ws-body-auto">Date.now() 자동</span>
        )}
        {field.valueType === "param" && (
          <input
            className="ws-body-input"
            placeholder="param 키 (예: teamId)"
            value={field.paramKey}
            onChange={(e) => set("paramKey", e.target.value)}
          />
        )}
      </td>
      <td>
        <button className="btn-icon" onClick={onRemove}>🗑</button>
      </td>
    </tr>
  );
}

function WSMessageCard({ msg, idx, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...msg, [k]: v });

  const updateField = (fi, updated) => {
    const body = msg.body.map((f, i) => (i === fi ? updated : f));
    set("body", body);
  };

  const addField = () => set("body", [...(msg.body || []), emptyField()]);

  const removeField = (fi) =>
    set("body", (msg.body || []).filter((_, i) => i !== fi));

  return (
    <div className="ws-msg-card">
      <div className="ws-msg-card-header">
        <span className="ws-msg-index">메시지 {idx + 1}</span>
        <div className="ws-msg-header-row">
          <div className="form-row ws-msg-inline">
            <label>Type</label>
            <input
              value={msg.type}
              onChange={(e) => set("type", e.target.value)}
              placeholder="CURSOR"
            />
          </div>
          <div className="form-row ws-msg-inline">
            <label>
              Interval
              <Tooltip text={"이 메시지를 전송하는 주기 (밀리초).\n예: 1000 = 1초마다 전송"} />
            </label>
            <input
              type="number"
              min={100}
              value={msg.interval}
              onChange={(e) => set("interval", Number(e.target.value))}
            />
            <span className="ws-unit">ms</span>
          </div>
        </div>
        <button className="btn-icon ws-msg-remove" onClick={onRemove}>🗑</button>
      </div>

      <div className="ws-body-section">
        <label className="ws-body-label">
          Body 필드
          <Tooltip text={"전송할 JSON 메시지의 필드를 정의합니다.\n고정값: 문자열/숫자 그대로 전송\n랜덤 정수: min~max 사이 랜덤값\n현재 시각: Date.now()\nparams 값: params 파일의 해당 키 값"} />
        </label>
        <table className="ws-body-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value 타입</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(msg.body || []).map((field, fi) => (
              <BodyFieldRow
                key={fi}
                field={field}
                onChange={(updated) => updateField(fi, updated)}
                onRemove={() => removeField(fi)}
              />
            ))}
          </tbody>
        </table>
        <button className="btn-ghost ws-add-field" onClick={addField}>
          + 필드 추가
        </button>
      </div>
    </div>
  );
}

export default function WSMessageForm({ messages = [], onChange }) {
  const add = () => onChange([...messages, emptyMessage()]);

  const update = (i, updated) =>
    onChange(messages.map((m, idx) => (idx === i ? updated : m)));

  const remove = (i) => onChange(messages.filter((_, idx) => idx !== i));

  return (
    <div className="ws-message-form">
      {messages.map((msg, i) => (
        <WSMessageCard
          key={i}
          idx={i}
          msg={msg}
          onChange={(updated) => update(i, updated)}
          onRemove={() => remove(i)}
        />
      ))}
      <button className="btn-secondary" onClick={add}>
        + 메시지 추가
      </button>
    </div>
  );
}
