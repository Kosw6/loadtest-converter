import React from "react";

export default function ParamsConfig({ params, onChange }) {
  const setRows = (val) => {
    try {
      const parsed = JSON.parse(val);
      onChange({ ...params, rows: parsed });
    } catch (_) {}
  };

  const setPerUser = (val) => {
    try {
      const parsed = JSON.parse(val);
      onChange({ ...params, perUser: parsed });
    } catch (_) {}
  };

  return (
    <section className="card">
      <h2>📦 Params</h2>
      <p className="hint">rows 또는 perUser 중 필요한 것만 입력하세요. (비워두면 ZIP에 미포함)</p>

      <div className="form-row col">
        <label>rows (배열 JSON)</label>
        <textarea
          rows={5}
          defaultValue={JSON.stringify(params.rows || [], null, 2)}
          onChange={(e) => setRows(e.target.value)}
          placeholder='[{"key":"value"}, ...]'
        />
      </div>

      <div className="form-row col">
        <label>perUser (유저별 JSON)</label>
        <textarea
          rows={5}
          defaultValue={JSON.stringify(params.perUser || {}, null, 2)}
          onChange={(e) => setPerUser(e.target.value)}
          placeholder='{"userId1": [{"key":"value"}], ...}'
        />
      </div>
    </section>
  );
}
