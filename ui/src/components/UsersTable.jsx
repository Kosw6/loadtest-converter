import React, { useState } from "react";

const DEFAULT_COLUMNS = ["userId", "loginId", "password"];

export default function UsersTable({ users, onChange }) {
  const [columns, setColumns] = useState(
    users.length > 0 ? Object.keys(users[0]) : DEFAULT_COLUMNS
  );
  const [newCol, setNewCol] = useState("");

  const addColumn = () => {
    if (!newCol.trim() || columns.includes(newCol.trim())) return;
    setColumns([...columns, newCol.trim()]);
    setNewCol("");
  };

  const removeColumn = (col) => {
    setColumns(columns.filter((c) => c !== col));
    onChange(users.map((r) => {
      const next = { ...r };
      delete next[col];
      return next;
    }));
  };

  const addRow = () => {
    const row = {};
    columns.forEach((c) => (row[c] = ""));
    onChange([...users, row]);
  };

  const removeRow = (idx) => onChange(users.filter((_, i) => i !== idx));

  const setCell = (rowIdx, col, val) => {
    const next = users.map((r, i) => (i === rowIdx ? { ...r, [col]: val } : r));
    onChange(next);
  };

  return (
    <section className="card">
      <h2>👤 Users (users.csv)</h2>
      <p className="hint">쿠키 로그인 step이 있을 때 사용됩니다.</p>

      <div className="col-controls">
        <input
          placeholder="컬럼 추가 (e.g. userName)"
          value={newCol}
          onChange={(e) => setNewCol(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addColumn()}
        />
        <button className="btn-ghost" onClick={addColumn}>+ 컬럼</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>
                  {c}
                  <button className="btn-icon-sm" onClick={() => removeColumn(c)}>✕</button>
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((row, rIdx) => (
              <tr key={rIdx}>
                {columns.map((c) => (
                  <td key={c}>
                    <input
                      value={row[c] || ""}
                      onChange={(e) => setCell(rIdx, c, e.target.value)}
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
    </section>
  );
}
