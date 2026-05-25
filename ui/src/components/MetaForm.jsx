import React from "react";

export default function MetaForm({ meta, onChange }) {
  const set = (key, val) => onChange({ ...meta, [key]: val });

  return (
    <section id="tour-meta-section" className="card">
      <h2>📋 시나리오 메타</h2>
      <div className="form-row">
        <label>이름</label>
        <input
          value={meta.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. n+1-comparison"
        />
      </div>
      <div className="form-row">
        <label>설명</label>
        <input
          value={meta.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="시나리오 설명"
        />
      </div>
    </section>
  );
}
