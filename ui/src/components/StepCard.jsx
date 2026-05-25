import React, { useState } from "react";
import ActionForm from "./ActionForm.jsx";
import FinalCheckForm from "./FinalCheckForm.jsx";
import InlineUsersTable from "./InlineUsersTable.jsx";
import InlineParamsEditor from "./InlineParamsEditor.jsx";
import Tooltip from "./Tooltip.jsx";

const TEMPLATES = [
  { value: "no_auth", label: "인증 없음 (k6_http_get_no_auth)" },
  { value: "cookie_auth", label: "쿠키 로그인 (k6_http_actions_cookie_auth)" },
];

// panelMode=true: 헤더/접기 없이 body만 렌더 (NodeEditPanel에서 사용)
// tourPrefix: 첫 번째 StepCard에만 전달되는 투어 ID 접두사 (e.g. "tour-step-0")
export default function StepCard({ step, allStepIds, onChange, onRemove, panelMode = false, tourPrefix }) {
  const [open, setOpen] = useState(true);

  const set = (key, val) => onChange({ ...step, [key]: val });
  const setUsers = (key, val) => onChange({ ...step, users: { ...step.users, [key]: val } });
  const setLogin = (key, val) =>
    onChange({ ...step, users: { ...step.users, login: { ...step.users.login, [key]: val } } });
  const setParams = (key, val) => onChange({ ...step, params: { ...step.params, [key]: val } });

  const toggleDepend = (id) => {
    const cur = step.dependsOn || [];
    set("dependsOn", cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const otherStepIds = (allStepIds || []).filter((id) => id !== step.id);

  // auth step과 k6 step에서 공통으로 쓰는 users 인증 설정 UI
  const usersAuthSection = (
    <>
      <div className="form-row">
        <label>
          Auth Type
          <Tooltip text={"none: 인증 없이 요청\nlogin: users.csv의 계정으로 로그인 후 쿠키를 자동 주입"} />
        </label>
        <select value={step.users?.authType || "none"} onChange={(e) => setUsers("authType", e.target.value)}>
          <option value="none">없음</option>
          <option value="login">쿠키 로그인</option>
        </select>
      </div>
      {step.users?.authType === "login" && (
        <div className="sub-section">
          <div className="form-row">
            <label>
              Login URL
              <Tooltip text={"로그인 API 경로. Base URL 뒤에 붙는 path.\n예: /api/login/signin"} />
            </label>
            <input value={step.users.login?.url || ""} onChange={(e) => setLogin("url", e.target.value)} placeholder="/api/login/signin" />
          </div>
          <div className="form-row">
            <label>Method</label>
            <select value={step.users.login?.method || "POST"} onChange={(e) => setLogin("method", e.target.value)}>
              <option>POST</option><option>GET</option>
            </select>
          </div>
          <div className="form-row">
            <label>
              Cookie Name
              <Tooltip text={"로그인 응답에서 추출할 쿠키 이름.\n이후 모든 요청에 이 쿠키가 자동으로 붙습니다.\n예: accessToken"} />
            </label>
            <input value={step.users.login?.cookieName || ""} onChange={(e) => setLogin("cookieName", e.target.value)} placeholder="accessToken" />
          </div>
          <div className="form-row col">
            <label>
              Login Body (JSON)
              <Tooltip text={"로그인 요청 body.\n{{user.컬럼명}} 으로 users.csv 값을 참조합니다.\n예: {\"loginId\": \"{{user.loginId}}\", \"password\": \"{{user.password}}\"}"}  />
            </label>
            <textarea
              rows={3}
              value={JSON.stringify(step.users.login?.body || {}, null, 2)}
              onChange={(e) => { try { setLogin("body", JSON.parse(e.target.value)); } catch (_) {} }}
            />
          </div>
          <InlineUsersTable usersData={step.usersData || []} onChange={(data) => set("usersData", data)} />
        </div>
      )}
    </>
  );

  const body = (
    <>
      {/* 기본 정보 */}
      <div className="form-row">
        <label>
          ID
          <Tooltip text={"이 step의 고유 식별자.\n다른 step의 depends_on에서 이 ID를 참조합니다.\n예: load-test, auth-step"} />
        </label>
        <input value={step.id} onChange={(e) => set("id", e.target.value)} placeholder="step-id" />
      </div>
      <div className="form-row">
        <label>Name</label>
        <input value={step.name} onChange={(e) => set("name", e.target.value)} placeholder="step 이름" />
      </div>
      <div id={tourPrefix ? `${tourPrefix}-type` : undefined} className="form-row">
        <label>
          Type
          <Tooltip text={"k6: 부하 생성 (가상 유저 트래픽)\nauth: k6 실행 전 사용자별 로그인 사전 처리\nfinal_check: k6 완료 후 DB 최종 상태 HTTP 검증\ncommand: shell 명령 실행 (DB seed, cleanup 등)"} />
        </label>
        <select value={step.type} onChange={(e) => set("type", e.target.value)}>
          <option value="k6">k6</option>
          <option value="auth">auth (사전 로그인)</option>
          <option value="final_check">final_check (상태 검증)</option>
          <option value="command">command</option>
        </select>
      </div>

      {/* depends_on */}
      {otherStepIds.length > 0 && (
        <div className="form-row col">
          <label>
            Depends On
            <Tooltip text={"이 step 실행 전에 완료되어야 할 step.\n선택한 step들이 모두 끝난 뒤 이 step이 시작됩니다.\n미선택 step들은 같은 wave에서 병렬 실행됩니다."} />
          </label>
          <div className="chip-group">
            {otherStepIds.map((id) => (
              <button
                key={id}
                className={`chip ${(step.dependsOn || []).includes(id) ? "chip-active" : ""}`}
                onClick={() => toggleDepend(id)}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Command */}
      {step.type === "command" && (
        <div className="form-row col">
          <label>
            Command
            <Tooltip text={"실행할 shell 명령어.\nWindows: PowerShell, Linux/Mac: sh -c 로 실행됩니다.\n예: node scripts/seed.js"} />
          </label>
          <textarea
            rows={4}
            value={step.command}
            onChange={(e) => set("command", e.target.value)}
            placeholder="실행할 shell 명령어"
          />
        </div>
      )}

      {/* Auth step */}
      {step.type === "auth" && (
        <>
          <div className="section-divider">Auth 설정</div>
          <p className="hint">k6 부하 실행 전에 users.csv의 모든 계정을 미리 로그인해 auth_context.json을 생성합니다. k6는 이 파일을 읽어 VU마다 개별 인증 헤더를 주입합니다.</p>
          <div className="form-row">
            <label>
              Base URL
              <Tooltip text={"로그인 요청을 보낼 서버 주소.\n예: http://localhost:8080"} />
            </label>
            <input value={step.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="http://localhost:8080" />
          </div>
          {usersAuthSection}
        </>
      )}

      {/* Final Check step */}
      {step.type === "final_check" && (
        <>
          <div className="section-divider">Final Check 설정</div>
          <p className="hint">k6 부하 완료 후 Go 엔진이 직접 HTTP 요청을 보내 DB 최종 상태를 검증합니다. 동시성 오류, 중복 처리, 롤백 여부 등을 확인할 때 사용합니다.</p>
          <div className="form-row">
            <label>
              Base URL
              <Tooltip text={"검증 요청을 보낼 서버 주소.\n예: http://localhost:8080"} />
            </label>
            <input value={step.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="http://localhost:8080" />
          </div>
          <div className="section-divider">Checks</div>
          <FinalCheckForm
            checks={step.checks || []}
            onChange={(checks) => set("checks", checks)}
          />
        </>
      )}

      {/* k6 */}
      {step.type === "k6" && (
        <>
          <div className="section-divider">k6 설정</div>
          <div className="form-row">
            <label>
              Template
              <Tooltip text={"사용할 k6 스크립트 템플릿.\n인증 없음: 단순 HTTP 요청\n쿠키 로그인: auth step과 연동하거나 per-VU 로그인 처리"} />
            </label>
            <select value={step.template} onChange={(e) => set("template", e.target.value)}>
              {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div id={tourPrefix ? `${tourPrefix}-base-url` : undefined} className="form-row">
            <label>
              Base URL
              <Tooltip text={"부하를 보낼 서버 주소.\n예: http://localhost:8080"} />
            </label>
            <input value={step.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="http://localhost:8080" />
          </div>
          <div className="form-row">
            <label>
              Flow
              <Tooltip text={"sequential: actions를 순서대로 모두 실행\nweighted: action의 weight 비율로 1개를 랜덤 선택해 실행"} />
            </label>
            <select value={step.flow} onChange={(e) => set("flow", e.target.value)}>
              <option value="sequential">sequential</option>
              <option value="weighted">weighted</option>
            </select>
          </div>
          {/* 부하 방식 선택 */}
          <div id={tourPrefix ? `${tourPrefix}-load-mode` : undefined} className="form-row col">
            <label>
              요청 방식
              <Tooltip text={"RPS: 초당 요청 수 기준 — 일반 성능 측정\n총 요청 수: 정해진 횟수를 제한 시간 안에 실행 — 재고·멱등성 검증\nBurst: 총 요청 수를 모두 동시에 발사 — 순간 경합 검증"} />
            </label>
            <div className="load-mode-group">
              {[
                { value: "rps",            label: "RPS 기준" },
                { value: "total_requests", label: "총 요청 수" },
                { value: "burst",          label: "Burst" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`load-mode-btn ${(!step.loadMode && value === "rps") || step.loadMode === value ? "active" : ""}`}
                  onClick={() => set("loadMode", value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="load-mode-hint">
              {(!step.loadMode || step.loadMode === "rps") &&
                "초당 요청 수(RPS)를 고정해 일정 시간 동안 부하를 유지합니다."}
              {step.loadMode === "total_requests" &&
                "총 N개의 요청을 제한 시간 안에 모두 실행합니다. 재고·멱등성 검증에 적합합니다."}
              {step.loadMode === "burst" &&
                "N개의 요청을 동시에 한꺼번에 발사합니다. 순간 경합 상황을 재현합니다."}
            </p>
          </div>

          {/* RPS 모드 */}
          {(!step.loadMode || step.loadMode === "rps") && (<>
            <div className="form-row">
              <label>
                VUs
                <Tooltip text={"동시에 실행할 가상 유저(Virtual User) 수.\nRPS를 설정하면 이 값은 최대 사전 할당 VU 수로 사용됩니다."} />
              </label>
              <input type="number" value={step.vus} min={1} onChange={(e) => set("vus", Number(e.target.value))} />
            </div>
            <div className="form-row">
              <label>
                Duration
                <Tooltip text={"부하를 유지할 시간.\n예: 30s (30초), 1m (1분), 5m30s (5분 30초)"} />
              </label>
              <input value={step.duration} onChange={(e) => set("duration", e.target.value)} placeholder="30s" />
            </div>
            <div className="form-row">
              <label>
                RPS
                <Tooltip text={"초당 요청 수 (Requests Per Second).\n0이면 VU 기반 실행.\n값을 설정하면 constant-arrival-rate executor 사용."} />
              </label>
              <input type="number" value={step.rps} min={0} onChange={(e) => set("rps", Number(e.target.value))} />
            </div>
          </>)}

          {/* 총 요청 수 모드 */}
          {step.loadMode === "total_requests" && (<>
            <div className="form-row">
              <label>
                총 요청 수
                <Tooltip text={"전체 실행할 요청 횟수.\n모든 VU가 이 횟수를 나눠서 실행합니다.\n재고: 재고(10)보다 많게 설정해 경합을 만드세요."} />
              </label>
              <input type="number" value={step.totalRequests} min={1}
                onChange={(e) => set("totalRequests", Number(e.target.value))} />
            </div>
            <div className="form-row">
              <label>
                VUs
                <Tooltip text={"동시에 실행할 가상 유저 수.\nVUs = 총 요청 수이면 각 VU가 1번씩 동시에 실행합니다.\nVUs < 총 요청 수이면 VU당 여러 번 순차 실행합니다."} />
              </label>
              <input type="number" value={step.vus} min={1}
                onChange={(e) => set("vus", Number(e.target.value))} />
            </div>
            <div className="form-row">
              <label>
                Max Duration
                <Tooltip text={"테스트 최대 허용 시간.\n이 시간 안에 총 요청 수를 모두 실행하지 못하면 중단됩니다.\n예: 10s, 30s"} />
              </label>
              <input value={step.maxDuration} onChange={(e) => set("maxDuration", e.target.value)} placeholder="10s" />
            </div>
          </>)}

          {/* Burst 모드 */}
          {step.loadMode === "burst" && (<>
            <div className="form-row">
              <label>
                총 요청 수
                <Tooltip text={"동시에 발사할 요청 수.\nVUs가 자동으로 같은 수로 설정되어 최대 동시성을 만듭니다."} />
              </label>
              <input type="number" value={step.totalRequests} min={1}
                onChange={(e) => set("totalRequests", Number(e.target.value))} />
            </div>
            <div className="form-row">
              <label>
                Max Duration
                <Tooltip text={"Burst 최대 허용 시간.\n모든 요청이 이 시간 안에 완료되어야 합니다.\n예: 5s, 10s"} />
              </label>
              <input value={step.maxDuration} onChange={(e) => set("maxDuration", e.target.value)} placeholder="10s" />
            </div>
            <p className="hint">VUs = {step.totalRequests || 0}개 자동 설정 (총 요청 수와 동일)</p>
          </>)}

          {/* 인증 */}
          <div className="section-divider">인증 (Users)</div>
          {usersAuthSection}

          {/* Params */}
          <div className="section-divider">Params</div>
          <div className="form-row">
            <label>
              Mode
              <Tooltip text={"rows: 모든 VU가 params 목록에서 공통으로 선택\nper_user: 유저별로 별도 params 세트를 할당 (접근 가능한 리소스가 유저마다 다를 때)"} />
            </label>
            <select value={step.params.mode} onChange={(e) => setParams("mode", e.target.value)}>
              <option value="rows">rows</option>
              <option value="per_user">per_user</option>
            </select>
          </div>
          <div className="form-row">
            <label>
              Strategy
              <Tooltip text={"round_robin: iteration 순서대로 순환 선택\nrandom: 매번 랜덤 선택"} />
            </label>
            <select value={step.params.strategy} onChange={(e) => setParams("strategy", e.target.value)}>
              <option value="round_robin">round_robin</option>
              <option value="random">random</option>
            </select>
          </div>
          {step.params.mode === "per_user" && (
            <div className="form-row">
              <label>
                User Key
                <Tooltip text={"users.csv에서 유저를 식별하는 컬럼명.\n이 값으로 params의 per_user 데이터를 매핑합니다.\n기본값: userId"} />
              </label>
              <input value={step.params.userKey || ""} onChange={(e) => setParams("userKey", e.target.value)} placeholder="userId" />
            </div>
          )}
          <InlineParamsEditor
            paramsData={step.paramsData || null}
            mode={step.params.mode}
            onChange={(data) => set("paramsData", data)}
          />

          {/* Actions */}
          <div id={tourPrefix ? `${tourPrefix}-actions` : undefined}>
            <div className="section-divider">Actions</div>
            <ActionForm
              actions={step.actions}
              onChange={(actions) => set("actions", actions)}
              showWeight={step.flow === "weighted"}
            />
          </div>
        </>
      )}
    </>
  );

  // panelMode: 헤더 없이 body만
  if (panelMode) {
    return <div className="step-body step-body--panel">{body}</div>;
  }

  return (
    <div className="step-card">
      <div className="step-header" onClick={() => setOpen(!open)}>
        <span className={`step-type-badge type-${step.type}`}>{step.type.toUpperCase()}</span>
        <span className="step-title">{step.name || step.id || "(이름 없음)"}</span>
        <span className="step-toggle">{open ? "▲" : "▼"}</span>
        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onRemove(); }}>🗑</button>
      </div>
      {open && <div className="step-body">{body}</div>}
    </div>
  );
}
