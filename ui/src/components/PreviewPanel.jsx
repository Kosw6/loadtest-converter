import React from "react";

export default function PreviewPanel({ yaml, loading, error }) {
  if (loading) return <div className="preview-panel"><span className="hint">생성 중...</span></div>;
  if (error) return <div className="preview-panel error">{error}</div>;
  if (!yaml) return (
    <div className="preview-panel empty">
      <span className="hint">「미리보기」를 누르면 scenario.yml이 여기 표시됩니다.</span>
    </div>
  );

  return (
    <div className="preview-panel">
      <pre>{yaml}</pre>
    </div>
  );
}
