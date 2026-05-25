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
import NodeEditPanel from "../components/NodeEditPanel.jsx";

// ── 노드 타입 등록 ────────────────────────────────────────────────────────────
const NODE_TYPES = { stepNode: StepNode };

// ── DAG 레이아웃 계산 ─────────────────────────────────────────────────────────
function computeLayout(steps) {
  if (!steps.length) return {};

  const levelMap = {};
  const getLevel = (id, visiting = new Set()) => {
    if (id in levelMap) return levelMap[id];
    if (visiting.has(id)) return 0; // 순환 방지
    visiting.add(id);
    const step = steps.find((s) => s.id === id);
    if (!step?.dependsOn?.length) return (levelMap[id] = 0);
    const max = Math.max(...step.dependsOn.map((d) => getLevel(d, new Set(visiting))));
    return (levelMap[id] = max + 1);
  };
  steps.forEach((s) => getLevel(s.id));

  // 레벨별 그룹핑
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

// steps → RF nodes (기존 노드의 position 유지)
function toNodes(steps, existing = []) {
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

// steps → RF edges
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

// ── FlowPage ──────────────────────────────────────────────────────────────────
export default function FlowPage() {
  const { steps, addStep, updateStepById, removeStepById, addDependency, removeDependency } =
    useScenario();

  const allStepIds = steps.map((s) => s.id);

  const [nodes, setNodes, onNodesChange] = useNodesState(() => toNodes(steps));
  const [edges, setEdges, onEdgesChange] = useEdgesState(() => toEdges(steps));
  const [selectedId, setSelectedId] = useState(null);

  // steps가 외부(FormPage)에서 변경되면 노드/엣지 동기화
  const prevCountRef = useRef(steps.length);
  useEffect(() => {
    if (steps.length !== prevCountRef.current) {
      setNodes((prev) => toNodes(steps, prev));
      setEdges(toEdges(steps));
      prevCountRef.current = steps.length;
    } else {
      // 데이터만 업데이트 (position은 유지)
      setNodes((prev) =>
        prev.map((n) => {
          const s = steps.find((s) => s.id === n.id);
          return s ? { ...n, data: { step: s } } : n;
        })
      );
      setEdges(toEdges(steps));
    }
  }, [steps]);

  // ── 연결 ────────────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection) => {
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

  // ── 엣지 삭제 (Delete 키) ────────────────────────────────────────────────────
  const onEdgesDelete = useCallback(
    (deleted) => {
      deleted.forEach((e) => removeDependency(e.target, e.source));
    },
    [removeDependency]
  );

  // ── 노드 위치 저장 ────────────────────────────────────────────────────────────
  const onNodeDragStop = useCallback((_, node) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
    );
  }, []);

  // ── 노드 클릭 ────────────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_, node) => {
    setSelectedId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  // ── step 편집 (패널에서) ──────────────────────────────────────────────────────
  const handleStepChange = useCallback(
    (updated) => {
      const oldId = selectedId;
      const newId = updated.id;
      const idChanged = oldId !== newId;

      // context 업데이트 (ID 변경 시 cascade는 context 내부에서 처리)
      updateStepById(oldId, updated);

      if (idChanged) {
        // RF 노드 ID 변경
        setNodes((prev) =>
          prev.map((n) =>
            n.id === oldId ? { ...n, id: newId, data: { step: updated } } : n
          )
        );
        // RF 엣지의 source/target 업데이트
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

  // ── step 삭제 ────────────────────────────────────────────────────────────────
  const handleRemove = useCallback(
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
    // 임시 ID: 패널에서 사용자가 직접 변경
    const tempId = `new-step-${Date.now()}`;
    const s = { ...newStep(steps.length), id: tempId };
    addStep(s);
    const newNode = {
      id: tempId,
      type: "stepNode",
      position: { x: 80 + (steps.length % 5) * 60, y: 80 + Math.floor(steps.length / 5) * 160 },
      data: { step: s },
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedId(tempId);
  }, [steps.length, addStep]);

  // ── 패널 너비 드래그 리사이즈 ───────────────────────────────────────────────
  const PANEL_MIN = 280;
  const PANEL_MAX = 720;
  const PANEL_DEFAULT = 420;

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
    if (!resizing) {
      document.body.classList.remove("resizing");
      return;
    }
    document.body.classList.add("resizing");
    const onMove = (e) => {
      const delta = resizeStartX.current - e.clientX; // 왼쪽으로 드래그 → 넓어짐
      const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, resizeStartW.current + delta));
      setPanelWidth(next);
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
  const panelOpen = selectedId !== null;  // ""(빈 ID)도 선택된 것으로 처리

  return (
    <div className="flow-page">
      {/* ── React Flow 캔버스 ── */}
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
            nodeColor={(n) =>
              n.data?.step?.type === "command" ? "#3fb950" : "#4c6ef5"
            }
            maskColor="rgba(13,17,23,0.7)"
          />
          <Panel position="top-left">
            <button className="btn-primary flow-add-btn" onClick={handleAddStep}>
              + Step 추가
            </button>
          </Panel>
          <Panel position="top-right" style={{ fontSize: 11, color: "#8b949e" }}>
            노드 클릭: 편집 &nbsp;|&nbsp; 핸들 드래그: 연결 &nbsp;|&nbsp; Delete: 엣지 삭제
          </Panel>
        </ReactFlow>
      </div>

      {/* ── 우측 편집 패널 ── */}
      <div
        className={`flow-panel ${panelOpen ? "flow-panel--open" : ""}`}
        style={panelOpen ? { width: panelWidth } : { width: 0 }}
      >
        {panelOpen && (
          <div
            className={`panel-resize-handle ${resizing ? "panel-resize-handle--active" : ""}`}
            onMouseDown={onResizeMouseDown}
            title="드래그해서 너비 조절"
          />
        )}
        <NodeEditPanel
          step={selectedStep}
          allStepIds={allStepIds}
          onChange={handleStepChange}
          onRemove={() => selectedId && handleRemove(selectedId)}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
