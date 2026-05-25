import React from "react";

// Generic key-value pair editor
// value: { [key]: string }
// onChange: (newObj) => void
export default function KVEditor({ label, value, onChange }) {
  const entries = Object.entries(value ?? {});

  const update = (idx, k, v) => {
    const next = [...entries];
    next[idx] = [k, v];
    onChange(Object.fromEntries(next));
  };

  const add = () => onChange({ ...(value ?? {}), "": "" });

  const remove = (idx) => {
    const next = entries.filter((_, i) => i !== idx);
    onChange(Object.fromEntries(next));
  };

  return (
    <div className="kv-editor">
      {label && <span className="kv-label">{label}</span>}
      {entries.map(([k, v], idx) => (
        <div key={idx} className="kv-row">
          <input
            placeholder="key"
            value={k}
            onChange={(e) => update(idx, e.target.value, v)}
          />
          <span>:</span>
          <input
            placeholder="value"
            value={v}
            onChange={(e) => update(idx, k, e.target.value)}
          />
          <button className="btn-icon" onClick={() => remove(idx)}>✕</button>
        </div>
      ))}
      <button className="btn-ghost" onClick={add}>+ 추가</button>
    </div>
  );
}
