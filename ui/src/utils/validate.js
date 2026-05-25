/**
 * 시나리오 유효성 검사.
 * 반환값: [{ stepIdx?: number, msg: string }]
 * stepIdx가 없으면 전역(meta) 오류
 */
export function validateScenario(meta, steps) {
  const errors = [];

  // ── meta ──
  if (!meta.name?.trim()) {
    errors.push({ msg: "시나리오 이름을 입력해주세요" });
  }

  if (!steps || steps.length === 0) {
    errors.push({ msg: "Step이 최소 1개 필요합니다" });
    return errors;
  }

  // ── step ID 중복 검사 ──
  const seen = new Set();
  steps.forEach((step, idx) => {
    if (step.id?.trim() && seen.has(step.id.trim())) {
      errors.push({ stepIdx: idx, msg: `Step ID "${step.id}"가 중복됩니다` });
    }
    if (step.id?.trim()) seen.add(step.id.trim());
  });

  // ── step별 검사 ──
  steps.forEach((step, idx) => {
    const label = `Step ${idx + 1}${step.name ? ` (${step.name})` : ""}`;

    if (!step.id?.trim()) {
      errors.push({ stepIdx: idx, msg: `${label}: ID를 입력해주세요` });
    }

    switch (step.type) {
      case "k6":
        if (!step.baseUrl?.trim()) {
          errors.push({ stepIdx: idx, msg: `${label}: Base URL을 입력해주세요` });
        }
        // 부하 방식별 필드 검증
        if (!step.loadMode || step.loadMode === "rps") {
          if (!step.duration?.trim()) {
            errors.push({ stepIdx: idx, msg: `${label}: Duration을 입력해주세요 (예: 30s)` });
          }
          if (!step.vus || step.vus < 1) {
            errors.push({ stepIdx: idx, msg: `${label}: VUs는 1 이상이어야 합니다` });
          }
        } else if (step.loadMode === "total_requests") {
          if (!step.totalRequests || step.totalRequests < 1) {
            errors.push({ stepIdx: idx, msg: `${label}: 총 요청 수는 1 이상이어야 합니다` });
          }
          if (!step.vus || step.vus < 1) {
            errors.push({ stepIdx: idx, msg: `${label}: VUs는 1 이상이어야 합니다` });
          }
          if (!step.maxDuration?.trim()) {
            errors.push({ stepIdx: idx, msg: `${label}: Max Duration을 입력해주세요 (예: 10s)` });
          }
        } else if (step.loadMode === "burst") {
          if (!step.totalRequests || step.totalRequests < 1) {
            errors.push({ stepIdx: idx, msg: `${label}: 총 요청 수는 1 이상이어야 합니다` });
          }
          if (!step.maxDuration?.trim()) {
            errors.push({ stepIdx: idx, msg: `${label}: Max Duration을 입력해주세요 (예: 10s)` });
          }
        }
        if (!step.actions?.length) {
          errors.push({ stepIdx: idx, msg: `${label}: Action이 최소 1개 필요합니다` });
        }
        step.actions?.forEach((a, aIdx) => {
          const aLabel = `${label} > Action ${aIdx + 1}`;
          if (!a.id?.trim()) errors.push({ stepIdx: idx, msg: `${aLabel}: ID를 입력해주세요` });
          if (!a.path?.trim()) errors.push({ stepIdx: idx, msg: `${aLabel}: Path를 입력해주세요` });
        });
        break;

      case "auth":
        if (!step.baseUrl?.trim()) {
          errors.push({ stepIdx: idx, msg: `${label}: Base URL을 입력해주세요` });
        }
        if (step.users?.authType !== "login") {
          errors.push({ stepIdx: idx, msg: `${label}: auth step의 Auth Type은 '쿠키 로그인'이어야 합니다` });
        } else {
          if (!step.users?.login?.url?.trim()) {
            errors.push({ stepIdx: idx, msg: `${label}: Login URL을 입력해주세요` });
          }
        }
        break;

      case "final_check":
        if (!step.baseUrl?.trim()) {
          errors.push({ stepIdx: idx, msg: `${label}: Base URL을 입력해주세요` });
        }
        if (!step.checks?.length) {
          errors.push({ stepIdx: idx, msg: `${label}: Check가 최소 1개 필요합니다` });
        }
        step.checks?.forEach((c, cIdx) => {
          const cLabel = `${label} > Check ${cIdx + 1}`;
          if (!c.id?.trim()) errors.push({ stepIdx: idx, msg: `${cLabel}: ID를 입력해주세요` });
          if (!c.path?.trim()) errors.push({ stepIdx: idx, msg: `${cLabel}: Path를 입력해주세요` });
        });
        break;

      case "command":
        if (!step.command?.trim()) {
          errors.push({ stepIdx: idx, msg: `${label}: Command를 입력해주세요` });
        }
        break;

      default:
        errors.push({ stepIdx: idx, msg: `${label}: 알 수 없는 step type "${step.type}"` });
    }
  });

  return errors;
}
