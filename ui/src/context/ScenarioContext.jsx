import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const LS_KEY = "lc_scenario";

function saveToLS(meta, steps) {
  try {
    // File 객체 등 직렬화 불가 필드 제외
    const sanitized = steps.map((s) => ({ ...s, paramsData: null, usersData: [] }));
    localStorage.setItem(LS_KEY, JSON.stringify({ meta, steps: sanitized }));
  } catch (_) {}
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function newStep(length = 0) {
  return {
    id: "",           // 빈 값 — 사용자가 직접 입력
    name: "",
    type: "k6",
    dependsOn: [],
    flow: "sequential",
    template: "no_auth",
    baseUrl: "http://localhost:8080",
    // 부하 방식 (rps | total_requests | burst)
    loadMode: "rps",
    vus: 5,
    rps: 0,
    duration: "30s",
    totalRequests: 30,
    maxDuration: "10s",
    actions: [],
    users: { authType: "none", login: { method: "POST", cookieName: "accessToken", body: {} } },
    usersData: [],
    params: { mode: "rows", strategy: "round_robin" },
    paramsData: null,
    command: "",
    checks: [],       // final_check step 전용
  };
}

// ID 변경 시 다른 step들의 depends_on을 일괄 업데이트
function cascadeRename(steps, oldId, newId) {
  if (!oldId || oldId === newId) return steps;
  return steps.map((s) => ({
    ...s,
    dependsOn: (s.dependsOn || []).map((d) => (d === oldId ? newId : d)),
  }));
}

const ScenarioContext = createContext(null);

export function ScenarioProvider({ children }) {
  const saved = loadFromLS();
  const [meta, setMeta] = useState(saved?.meta ?? { name: "", description: "" });
  const [steps, setSteps] = useState(saved?.steps ?? [newStep(0)]);

  // meta/steps 변경 시 localStorage에 자동 저장
  useEffect(() => {
    saveToLS(meta, steps);
  }, [meta, steps]);

  const addStep = useCallback((step) => {
    setSteps((prev) => [...prev, step || newStep(prev.length)]);
  }, []);

  // idx 기반 업데이트 — ID 변경 시 cascade
  const updateStep = useCallback((idx, updater) => {
    setSteps((prev) => {
      const old = prev[idx];
      const updated = typeof updater === "function" ? updater(old) : updater;
      const mapped = prev.map((s, i) => (i === idx ? updated : s));
      return cascadeRename(mapped, old?.id, updated?.id);
    });
  }, []);

  // ID(문자열) 기반 업데이트 — ID 변경 시 cascade
  const updateStepById = useCallback((oldId, updater) => {
    setSteps((prev) => {
      const old = prev.find((s) => s.id === oldId);
      const updated = typeof updater === "function" ? updater(old) : updater;
      const mapped = prev.map((s) => (s.id === oldId ? updated : s));
      return cascadeRename(mapped, oldId, updated?.id);
    });
  }, []);

  const removeStep = useCallback((idx) => {
    setSteps((prev) => {
      const removed = prev[idx];
      return prev
        .filter((_, i) => i !== idx)
        .map((s) => ({
          ...s,
          dependsOn: (s.dependsOn || []).filter((d) => d !== removed?.id),
        }));
    });
  }, []);

  const removeStepById = useCallback((id) => {
    setSteps((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s) => ({
          ...s,
          dependsOn: (s.dependsOn || []).filter((d) => d !== id),
        }))
    );
  }, []);

  const addDependency = useCallback((targetId, sourceId) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? { ...s, dependsOn: [...new Set([...(s.dependsOn || []), sourceId])] }
          : s
      )
    );
  }, []);

  const removeDependency = useCallback((targetId, sourceId) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? { ...s, dependsOn: (s.dependsOn || []).filter((d) => d !== sourceId) }
          : s
      )
    );
  }, []);

  return (
    <ScenarioContext.Provider
      value={{
        meta, setMeta,
        steps, setSteps,
        addStep, updateStep, updateStepById,
        removeStep, removeStepById,
        addDependency, removeDependency,
      }}
    >
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario() {
  return useContext(ScenarioContext);
}
