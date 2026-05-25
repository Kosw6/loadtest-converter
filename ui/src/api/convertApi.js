// 개발: VITE_API_URL 없음 → Vite proxy가 /api/* 를 localhost:8090으로 포워딩
// 프로덕션: VITE_API_URL=https://xxx.onrender.com 으로 설정
const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/convert`;

export async function importScenario(yamlStr) {
  const res = await fetch(`${BASE}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: yamlStr }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // ConvertRequest { meta, steps }
}

export async function previewScenario(payload) {
  const res = await fetch(`${BASE}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { yaml: "..." }
}

export async function exportScenario(payload) {
  const res = await fetch(`${BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${payload.meta?.name || "scenario"}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
