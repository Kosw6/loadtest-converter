import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useScenario } from "./context/ScenarioContext.jsx";
import { previewScenario, exportScenario } from "./api/convertApi.js";
import { validateScenario } from "./utils/validate.js";
import PreviewPanel from "./components/PreviewPanel.jsx";
import ImportDialog from "./components/ImportDialog.jsx";
import { useTour } from "./hooks/useTour.js";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { meta, infra, steps, setMeta, setInfra, setSteps } = useScenario();

  const [yaml, setYaml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const [importOpen, setImportOpen] = useState(false);

  // 유효성 검사 오류 목록 (미리보기/내보내기 전에 표시)
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationOpen, setValidationOpen] = useState(false);

  const isFlow = location.pathname === "/flow";
  const isTutorial = location.pathname === "/tutorial";

  const { startTour } = useTour();

  // 유효성 검사 후 통과하면 callback 실행
  const withValidation = (callback) => {
    const errors = validateScenario(meta, steps);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationOpen(true);
      return;
    }
    setValidationErrors([]);
    callback();
  };

  const handlePreview = () =>
    withValidation(async () => {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const res = await previewScenario({ meta, infra, steps });
        setYaml(res.yaml);
        setPreviewOpen(true);
      } catch (e) {
        setPreviewError(e.message);
        setPreviewOpen(true);
      } finally {
        setPreviewLoading(false);
      }
    });

  const handleExport = () =>
    withValidation(async () => {
      setExportLoading(true);
      try {
        await exportScenario({ meta, infra, steps });
      } catch (e) {
        alert("Export 실패: " + e.message);
      } finally {
        setExportLoading(false);
      }
    });

  // YAML import 완료 → 시나리오 덮어쓰기
  const handleImportDone = (req) => {
    setMeta(req.meta || { name: "", description: "" });
    setInfra(req.infra || { type: "docker-compose", file: "", envFile: "", nodes: [] });
    setSteps(req.steps || []);
  };

  return (
    <div className="app-shell">
      {/* ── 헤더 ── */}
      <header className="main-header">
        <div className="header-brand">🚀 Loadtest Converter</div>

        <nav className="header-tabs">
          <button
            className={`header-tab ${!isFlow && !isTutorial ? "active" : ""}`}
            onClick={() => navigate("/")}
          >
            📝 Form
          </button>
          <button
            className={`header-tab ${isFlow ? "active" : ""}`}
            onClick={() => navigate("/flow")}
          >
            🔗 Visual
          </button>
          <button
            className={`header-tab ${isTutorial ? "active" : ""}`}
            onClick={() => navigate("/tutorial")}
          >
            🎓 Tutorial
          </button>
        </nav>

        <div className="header-actions">
          {!isFlow && !isTutorial && (
            <button className="btn-ghost" onClick={startTour} title="UI 사용 가이드">
              ❓ 가이드
            </button>
          )}
          {!isTutorial && (
            <>
              <button id="tour-import-btn" className="btn-ghost" onClick={() => setImportOpen(true)}>
                📥 가져오기
              </button>
              <button id="tour-preview-btn" className="btn-secondary" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? "생성 중..." : "🔍 미리보기"}
              </button>
              <button id="tour-export-btn" className="btn-primary" onClick={handleExport} disabled={exportLoading}>
                {exportLoading ? "내보내는 중..." : "📦 ZIP"}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── 페이지 콘텐츠 ── */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* ── 유효성 검사 오류 모달 ── */}
      {validationOpen && (
        <div className="modal-overlay" onClick={() => setValidationOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>⚠️ 입력값을 확인해주세요</h2>
              <button className="btn-ghost" onClick={() => setValidationOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {validationErrors.map((e, i) => (
                <div key={i} className="error-msg" style={{ fontSize: 13 }}>
                  • {e.msg}
                </div>
              ))}
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-primary" onClick={() => setValidationOpen(false)}>확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── YAML 미리보기 모달 ── */}
      {previewOpen && (
        <div className="modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>scenario.yml</h2>
              <div style={{ display: "flex", gap: 8 }}>
                {yaml && (
                  <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(yaml)}>
                    복사
                  </button>
                )}
                <button className="btn-ghost" onClick={() => setPreviewOpen(false)}>✕</button>
              </div>
            </div>
            <PreviewPanel yaml={yaml} loading={previewLoading} error={previewError} />
          </div>
        </div>
      )}

      {/* ── YAML 가져오기 모달 ── */}
      {importOpen && (
        <ImportDialog
          onImport={handleImportDone}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
