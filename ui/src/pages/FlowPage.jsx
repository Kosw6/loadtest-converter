import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useScenario, newStep } from "../context/ScenarioContext.jsx";
import StepNode from "../components/StepNode.jsx";
import InfraFlowNode from "../components/InfraFlowNode.jsx";
import NodeEditPanel from "../components/NodeEditPanel.jsx";

// ── 노드 타입 등록 ────────────────────────────────────────────────────────────
const NODE_TYPES = { stepNode: StepNode, infraNode: InfraFlowNode };

// ── DAG 레이아웃 계산 (step 노드용) ──────────────────────────────────────────
function computeLayout(steps) {
  if (!steps.length) return {};
  const levelMap = {};
  const getLevel = (id, visiting = new Set()) => {
    if (id in levelMap) return levelMap[id];
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const step = steps.find((s) => s.id === id);
    if (!step?.dependsOn?.length) return (levelMap[id] = 0);
    const max = Math.max(...step.dependsOn.map((d) => getLevel(d, new Set(visiting))));
    return (levelMap[id] = max + 1);
  };
  steps.forEach((s) => getLevel(s.id));

  const byLevel = {};
  steps.forEach((s) => {
    const l = levelMap[s.id] ?? 0;
    (byLevel[l] = byLevel[l] || []).push(s.id);
  });

  const NODE_W = 220, NODE_H = 90, H_GAP = 60, V_GAP = 80;
  const maxCount = Math.max(...Object.values(byLevel).map((a) => a.length));
  const totalMaxW = maxCount * NODE_W + (maxCount - 1) * H_GAP;

  const positions = {};
  Object.entries(byLevel).forEach(([lvl, ids]) => {
    const rowW = ids.length * NODE_W + (ids.length - 1) * H_GAP;
    const startX = (totalMaxW - rowW) / 2;
    ids.forEach((id, i) => {
      positions[id] = {
        x: startX + i * (NODE_W + H_GAP) + 60,
        y: parseInt(lvl) * (NODE_H + V_GAP) + 60,
      };
    });
  });
  return positions;
}

function toStepNodes(steps, existing = []) {
  const layout = computeLayout(steps);
  return steps.map((step) => {
    const prev = existing.find((n) => n.id === step.id);
    return {
      id: step.id,
      type: "stepNode",
      position: prev?.position ?? layout[step.id] ?? { x: 100, y: 100 },
      data: { step },
    };
  });
}

function toEdges(steps) {
  const EDGE_STYLE = { stroke: "#4c6ef5", strokeWidth: 2 };
  return steps.flatMap((step) =>
    (step.dependsOn || []).map((dep) => ({
      id: `${dep}->${step.id}`,
      source: dep,
      target: step.id,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#4c6ef5" },
      style: EDGE_STYLE,
    }))
  );
}

// infra 노드 → RF 노드 (RF id = __infra__${idx})
function toInfraRFNodes(infraNodes, existing = [], onUpdate, onRemove) {
  return (infraNodes || []).map((node, idx) => {
    const rfId = `__infra__${idx}`;
    const prev = existing.find((n) => n.id === rfId);
    return {
      id: rfId,
      type: "infraNode",
      position: prev?.position ?? {
        x: 700 + (idx % 3) * 240,
        y: 40 + Math.floor(idx / 3) * 150,
      },
      data: {
        node,
        onUpdate: (updated) => onUpdate(idx, updated),
        onRemove: () => onRemove(idx),
      },
      draggable: true,
      selectable: true,
    };
  });
}

// ── FlowPage ──────────────────────────────────────────────────────────────────
export default function FlowPage() {
  const {
    steps, infra, setInfra,
    addStep, updateStepById, removeStepById,
    addDependency, removeDependency,
  } = useScenario();

  const allStepIds = steps.map((s) => s.id);

  // ── infra 조작 ───────────────────────────────────────────────────────────────
  const handleUpdateInfra = useCallback((idx, updated) => {
    setInfra((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n, i) => (i === idx ? updated : n)),
    }));
  }, [setInfra]);

  const handleRemoveInfra = useCallback((idx) => {
    setInfra((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((_, i) => i !== idx),
    }));
  }, [setInfra]);

  const handleAddInfra = useCallback(() => {
    setInfra((prev) => ({
      ...prev,
      nodes: [...(prev.nodes || []), { id: "", container: "" }],
    }));
  }, [setInfra]);

  // ── RF 상태 초기화 ──────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState(() => [
    ...toStepNodes(steps),
    ...toInfraRFNodes(infra?.nodes || [], [], handleUpdateInfra, handleRemoveInfra),
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => toEdges(steps));
  const [selectedId, setSelectedId] = useState(null);

  // ── steps 동기화 ─────────────────────────────────────────────────────────────
  const prevStepCountRef = useRef(steps.length);
  useEffect(() => {
    setNodes((prev) => {
      const infraRF = prev.filter((n) => n.type === "infraNode");
      const stepRF  = prev.filter((n) => n.type === "stepNode");
      const newStepNodes = toStepNodes(steps, stepRF);
      return [...newStepNodes, ...infraRF];
    });
    setEdges(toEdges(steps));
    prevStepCountRef.current = steps.length;
  }, [steps]);

  // ── infra 동기화 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setNodes((prev) => {
      const stepRF  = prev.filter((n) => n.type === "stepNode");
      const infraRF = prev.filter((n) => n.type === "infraNode");
      const newInfraNodes = toInfraRFNodes(
        infra?.nodes || [], infraRF, handleUpdateInfra, handleRemoveInfra
      );
      return [...stepRF, ...newInfraNodes];
    });
  }, [infra, handleUpdateInfra, handleRemoveInfra]);

  // ── 연결 ────────────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection) => {
      // infra 노드끼리 / infra↔step 연결 방지
      if (connection.source?.startsWith("__infra__") || connection.target?.startsWith("__infra__")) return;
      const edge = {
        ...connection,
        id: `${connection.source}->${connection.target}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4c6ef5" },
        style: { stroke: "#4c6ef5", strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(edge, eds));
      addDependency(connection.target, connection.source);
    },
    [addDependency]
  );

  const onEdgesDelete = useCallback(
    (deleted) => { deleted.forEach((e) => removeDependency(e.target, e.source)); },
    [removeDependency]
  );

  const onNodeDragStop = useCallback((_, node) => {
    setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, position: node.position } : n)));
  }, []);

  // ── 노드 클릭: infra 노드는 인라인 편집이므로 패널 열지 않음 ─────────────────
  const onNodeClick = useCallback((_, node) => {
    if (node.type === "infraNode") return;
    setSelectedId(node.id);
  }, []);

  const onPaneClick = useCallback(() => { setSelectedId(null); }, []);

  // ── step 편집 ─────────────────────────────────────────────────────────────
  const handleStepChange = useCallback(
    (updated) => {
      const oldId = selectedId;
      const newId = updated.id;
      updateStepById(oldId, updated);
      if (oldId !== newId) {
        setNodes((prev) =>
          prev.map((n) => n.id === oldId ? { ...n, id: newId, data: { step: updated } } : n)
        );
        setEdges((prev) =>
          prev.map((e) => ({
            ...e,
            id: e.id.replace(oldId, newId),
            source: e.source === oldId ? newId : e.source,
            target: e.target === oldId ? newId : e.target,
          }))
        );
        setSelectedId(newId);
      } else {
        setNodes((prev) =>
          prev.map((n) => (n.id === newId ? { ...n, data: { step: updated } } : n))
        );
      }
    },
    [selectedId, updateStepById]
  );

  const handleRemoveStep = useCallback(
    (id) => {
      removeStepById(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
    },
    [removeStepById]
  );

  // ── step 추가 ────────────────────────────────────────────────────────────────
  const handleAddStep = useCallback(() => {
    const tempId = `new-step-${Date.now()}`;
    const s = { ...newStep(steps.length), id: tempId };
    addStep(s);
    setNodes((prev) => [
      ...prev,
      {
        id: tempId,
        type: "stepNode",
        position: { x: 80 + (steps.length % 5) * 60, y: 80 + Math.floor(steps.length / 5) * 160 },
        data: { step: s },
      },
    ]);
    setSelectedId(tempId);
  }, [steps.length, addStep]);

  // ── 패널 리사이즈 ─────────────────────────────────────────────────────────
  const PANEL_MIN = 280, PANEL_MAX = 720, PANEL_DEFAULT = 420;
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartW.current = panelWidth;
    setResizing(true);
  }, [panelWidth]);

  useEffect(() => {
    if (!resizing) { document.body.classList.remove("resizing"); return; }
    document.body.classList.add("resizing");
    const onMove = (e) => {
      const delta = resizeStartX.current - e.clientX;
      setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, resizeStartW.current + delta)));
    };
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing");
    };
  }, [resizing]);

  const selectedStep = steps.find((s) => s.id === selectedId) ?? null;
  const panelOpen = selectedId !== null;

  return (
    <div className="flow-page">
      <div className="flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode="Delete"
        >
          <Background color="#30363d" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "infraNode") return "#3fb950";
              return n.data?.step?.type === "command" ? "#3fb950" : "#4c6ef5";
            }}
            maskColor="rgba(13,17,23,0.7)"
          />

          {/* ── 상단 좌측 버튼 ── */}
          <Panel position="top-left">
            <div className="flow-top-btns">
              <button className="btn-primary flow-add-btn" onClick={handleAddStep}>
                + Step
              </button>
              <button className="flow-infra-btn" onClick={handleAddInfra}>
                + Infra
              </button>
            </div>
          </Panel>

          <Panel position="top-right" style={{ fontSize: 11, color: "#8b949e" }}>
            노드 클릭: 편집 &nbsp;|&nbsp; 핸들 드래그: 연결 &nbsp;|&nbsp; Delete: 엣지 삭제
          </Panel>
        </ReactFlow>
      </div>

      {/* ── 우측 편집 패널 (step만) ── */}
      <div
        className={"flow-panel" + (panelOpen ? " flow-panel--open" : "")}
        style={panelOpen ? { width: panelWidth } : { width: 0 }}
      >
        {panelOpen && (
          <div
            className={"panel-resize-handle" + (resizing ? " panel-resize-handle--active" : "")}
            onMouseDown={onResizeMouseDown}
            title="드래그해서 너비 조절"
          />
        )}
        <NodeEditPanel
          step={selectedStep}
          allStepIds={allStepIds}
          infraNodes={infra?.nodes || []}
          onChange={handleStepChange}
          onRemove={() => selectedId && handleRemoveStep(selectedId)}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
