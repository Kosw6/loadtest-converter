import React, { useEffect, useState } from "react";
import { useScenario } from "../context/ScenarioContext.jsx";
import { importScenario } from "../api/convertApi.js";
import MetaForm from "../components/MetaForm.jsx";
import StepCard from "../components/StepCard.jsx";
import InfraPanel from "../components/InfraPanel.jsx";

export default function FormPage() {
  const { meta, setMeta, infra, setInfra, steps, setSteps, addStep, updateStep, removeStep } = useScenario();
  const [infraOpen, setInfraOpen] = useState(false);

  // 새 탭에서 열린 경우 pending YAML 자동 import
  useEffect(() => {
    const yaml = localStorage.getItem("lc_pending_yaml");
    if (!yaml) return;
    localStorage.removeItem("lc_pending_yaml");
    importScenario(yaml)
      .then((res) => {
        setMeta(res.meta || { name: "", description: "" });
        setSteps(res.steps || []);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const allStepIds = steps.map((s) => s.id);

  return (
    <div className="form-page">
      <MetaForm meta={meta} onChange={setMeta} />

      <section id="tour-steps-section" className="card">
        <div className="steps-header">
          <h2>⚡ Steps</h2>
          <div className="steps-header-actions">
            <button
              className={`btn-infra ${infra.nodes?.length > 0 ? "btn-infra--active" : ""}`}
              onClick={() => setInfraOpen(true)}
            >
              🏗 인프라 세팅
              {infra.nodes?.length > 0 && (
                <span className="infra-badge">{infra.nodes.length}</span>
              )}
            </button>
            <button id="tour-add-step" className="btn-primary" onClick={() => addStep()}>
              + Step 추가
            </button>
          </div>
        </div>

        {steps.map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            allStepIds={allStepIds}
            infraNodes={infra.nodes || []}
            onChange={(updated) => updateStep(idx, updated)}
            onRemove={() => removeStep(idx)}
            tourPrefix={idx === 0 ? "tour-step-0" : undefined}
          />
        ))}
      </section>

      {infraOpen && (
        <InfraPanel
          infra={infra}
          onChange={setInfra}
          onClose={() => setInfraOpen(false)}
        />
      )}
    </div>
  );
}
