import React, { useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useScenario, newStep } from "../context/ScenarioContext.jsx";

/* ══════════════════════════════════════════════════════════════════════════
   Visual 탭 로드 스텝 정의
══════════════════════════════════════════════════════════════════════════ */
/* 입문-1: 컨테이너 제어 */
const DOCKER_STEPS = [
  { id: "docker-01-cd",      name: "폴더 이동",  type: "command", dependsOn: [],                   command: "cd loadtest-converter" },
  { id: "docker-02-version", name: "버전 확인",  type: "command", dependsOn: ["docker-01-cd"],      command: "docker --version && docker-compose --version" },
  { id: "docker-03-up",      name: "서버 실행",  type: "command", dependsOn: ["docker-02-version"], command: "docker-compose up -d" },
  { id: "docker-04-stop",    name: "서버 정지",  type: "command", dependsOn: ["docker-03-up"],      command: "docker-compose stop" },
  { id: "docker-05-restart", name: "재시작",     type: "command", dependsOn: ["docker-04-stop"],    command: "docker-compose restart" },
  { id: "docker-06-down",    name: "종료",       type: "command", dependsOn: ["docker-05-restart"], command: "docker-compose down" },
];

/* 입문-2: 부하테스트 설정 — RPS 모드 예시 */
const LOADTEST_STEPS = [
  {
    id: "lt-01-reset",
    name: "지갑 초기화",
    type: "k6",
    dependsOn: [],
    loadMode: "total_requests",
    vus: 1,
    totalRequests: 1,
    baseUrl: "http://localhost:8080",
    template: "no_auth",
    flow: "sequential",
    actions: [{ id: "lt-a1", method: "DELETE", path: "/wallet/1/reset", headers: {}, body: {}, extract: [] }],
  },
  {
    id: "lt-02-deposit",
    name: "잔액 충전 — RPS 모드",
    type: "k6",
    dependsOn: ["lt-01-reset"],
    loadMode: "rps",
    vus: 5,
    rps: 10,
    duration: "30s",
    baseUrl: "http://localhost:8080",
    template: "no_auth",
    flow: "sequential",
    actions: [{ id: "lt-a2", method: "POST", path: "/wallet/1/deposit", headers: {}, body: { amount: 1000 }, extract: [] }],
  },
];

/* 입문-3: params.json 예시 — VU별 결제 */
const PARAMS_STEPS = [
  {
    id: "pm-01-reset",
    name: "결제 초기화",
    type: "k6",
    dependsOn: [],
    loadMode: "total_requests",
    vus: 1,
    totalRequests: 1,
    baseUrl: "http://localhost:8080",
    template: "no_auth",
    flow: "sequential",
    actions: [{ id: "pm-a1", method: "DELETE", path: "/payment/reset", headers: {}, body: {}, extract: [] }],
  },
  {
    id: "pm-02-pay",
    name: "VU별 결제 (params.json)",
    type: "k6",
    dependsOn: ["pm-01-reset"],
    loadMode: "rps",
    vus: 5,
    rps: 5,
    duration: "20s",
    baseUrl: "http://localhost:8080",
    template: "no_auth",
    flow: "sequential",
    params: { mode: "rows", strategy: "round_robin" },
    actions: [{ id: "pm-a2", method: "POST", path: "/payment/pay", headers: {}, body: { idempotencyKey: "${params.idempotencyKey}", amount: 5000 }, extract: [] }],
  },
];

/* 입문-3: users.csv 예시 — 사용자별 지갑 충전 */
const USERS_STEPS = [
  {
    id: "us-01-reset",
    name: "지갑 전체 초기화",
    type: "k6",
    dependsOn: [],
    loadMode: "total_requests",
    vus: 1,
    totalRequests: 1,
    baseUrl: "http://localhost:8080",
    template: "no_auth",
    flow: "sequential",
    actions: [{ id: "us-a1", method: "DELETE", path: "/wallet/reset-all", headers: {}, body: {}, extract: [] }],
  },
  {
    id: "us-02-deposit",
    name: "사용자별 독립 충전",
    type: "k6",
    dependsOn: ["us-01-reset"],
    loadMode: "rps",
    vus: 5,
    rps: 5,
    duration: "20s",
    baseUrl: "http://localhost:8080",
    template: "no_auth",
    flow: "sequential",
    users: { authType: "none", login: { method: "POST", cookieName: "accessToken", body: {} } },
    actions: [{ id: "us-a2", method: "POST", path: "/wallet/${users.userId}/deposit", headers: {}, body: { amount: 1000 }, extract: [] }],
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   공통 헬퍼 컴포넌트
══════════════════════════════════════════════════════════════════════════ */
function Section({ id, num, title, children }) {
  return (
    <section id={id} className="td-section">
      <div className="td-section-badge">{num} — {title}</div>
      {children}
    </section>
  );
}

function CmdBlock({ rows }) {
  return (
    <div className="sd-cmd-block">
      {rows.map(({ label, cmd, desc }, i) => (
        <div key={i} className="sd-cmd-item">
          <div className="sd-cmd-row">
            <span className="sd-cmd-label">{label}</span>
            <code className="sd-cmd-code">{cmd}</code>
          </div>
          {desc && <p className="sd-cmd-desc">{desc}</p>}
        </div>
      ))}
    </div>
  );
}

function InfoGrid({ rows }) {
  return (
    <div className="td-infobox">
      {rows.map(([k, v]) => (
        <div key={k} className="td-infobox-row">
          <span className="td-infobox-key">{k}</span>
          <span className="td-infobox-val">{v}</span>
        </div>
      ))}
    </div>
  );
}

function CompareCols({ left, right }) {
  return (
    <div className="td-compare">
      <div className="td-compare-col bad">
        <div className="td-compare-label bad">{left.label}</div>
        <div className="td-code">
          {left.lines.map((l, i) => (
            <div key={i} className="td-code-line">
              {l.comment ? <span className="td-code-comment">{l.text}</span> : l.text}
            </div>
          ))}
        </div>
      </div>
      <div className="td-compare-arrow">→</div>
      <div className="td-compare-col good">
        <div className="td-compare-label good">{right.label}</div>
        <div className="td-code">
          {right.lines.map((l, i) => (
            <div key={i} className="td-code-line">
              {l.comment ? <span className="td-code-comment">{l.text}</span> : l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Visual 탭 미리보기 — step-node CSS 그대로 재현
══════════════════════════════════════════════════════════════════════════ */
const NODE_META = {
  k6:      { icon: "⚡", color: "#4c6ef5", badge: "K6" },
  command: { icon: "💻", color: "#3fb950", badge: "CMD" },
};

function MockNode({ id, type = "command", name, sub, detail }) {
  const meta = NODE_META[type] || NODE_META.command;
  return (
    <div id={id} className="step-node sd-mock-node" style={{ "--node-color": meta.color }}>
      <div className="step-node-body">
        <div className="step-node-icon">{meta.icon}</div>
        <div className="step-node-info">
          <div className="step-node-name">{name}</div>
          <div className="step-node-meta">
            <span className="step-node-badge" style={{ background: meta.color + "28", color: meta.color }}>
              {meta.badge}
            </span>
            <span className="step-node-sub">{sub}</span>
          </div>
        </div>
      </div>
      {detail && (
        <div className="sd-mock-node-cmd"><code>{detail}</code></div>
      )}
    </div>
  );
}

function MockFlowSection({ id, hint, nodes, openLabel, onOpen }) {
  return (
    <div className="sd-visual-section" id={id}>
      <div className="sd-visual-label">
        <span className="sd-visual-badge">🔗 Visual 탭 미리보기</span>
        <span className="sd-visual-hint">{hint}</span>
      </div>
      <div className="sd-mock-flow">
        {nodes.map((n, i) => (
          <React.Fragment key={n.id}>
            <MockNode {...n} />
            {i < nodes.length - 1 && (
              <div className="sd-mock-arrow"><span>→</span></div>
            )}
          </React.Fragment>
        ))}
      </div>
      <button className="btn-primary sd-open-visual-btn" onClick={onOpen}>
        🔗 {openLabel || "Visual 탭에서 직접 열기"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   입문-1. 컨테이너 제어
══════════════════════════════════════════════════════════════════════════ */
function ContainerControlContent({ onStartTour, onOpenInVisual }) {
  const containerNodes = [
    { id: "sd-node-1", type: "command", name: "폴더 이동",  sub: "command", detail: "cd loadtest-converter" },
    { id: "sd-node-2", type: "command", name: "버전 확인",  sub: "command", detail: "docker --version && docker-compose --version" },
    { id: "sd-node-3", type: "command", name: "서버 실행",  sub: "command", detail: "docker-compose up -d" },
    { id: "sd-node-4", type: "command", name: "서버 정지",  sub: "command", detail: "docker-compose stop" },
    { id: "sd-node-5", type: "command", name: "재시작",     sub: "command", detail: "docker-compose restart" },
    { id: "sd-node-6", type: "command", name: "종료",       sub: "command", detail: "docker-compose down" },
  ];

  return (
    <div className="td-sections">
      <div className="sd-intro-bar">
        <p className="td-text">
          Docker Compose로 오케스트레이터 서버를 <strong>실행·정지·재시작·종료</strong>하는
          기본 명령어를 단계별로 익힙니다.
          처음 서버를 띄우기 전에 이 가이드를 먼저 읽어보세요.
        </p>
        <button className="btn-secondary sd-tour-btn" onClick={onStartTour}>
          🎯 가이드 스텝 시작
        </button>
      </div>

      <MockFlowSection
        id="sd-visual"
        hint="아래 구성이 실제 Visual 탭에 어떻게 보이는지 확인하세요"
        nodes={containerNodes}
        openLabel="Visual 탭에서 직접 열기"
        onOpen={onOpenInVisual}
      />

      <Section id="sd-prereq" num="01" title="사전 준비 — Docker 확인">
        <p className="td-text">
          먼저 <strong>Docker</strong>와 <strong>Docker Compose</strong>가 설치되어 있는지 확인합니다.
          터미널에 아래 명령어를 입력해 버전 정보가 출력되면 준비 완료입니다.
        </p>
        <CmdBlock rows={[
          { label: "Docker",   cmd: "docker --version",         desc: "예시 출력: Docker version 24.0.5, build ced0996" },
          { label: "Compose",  cmd: "docker-compose --version", desc: "예시 출력: Docker Compose version v2.20.2" },
        ]} />
        <InfoGrid rows={[
          ["Docker 없음",   "docker.com에서 Docker Desktop을 설치하세요 (Mac / Windows / Linux 지원)"],
          ["Compose 없음",  "Docker Desktop에는 Compose가 기본 포함됩니다"],
        ]} />
      </Section>

      <Section id="sd-folder" num="02" title="프로젝트 폴더로 이동">
        <p className="td-text">
          <code>docker-compose.yml</code>이 있는 <strong>loadtest-converter</strong> 폴더로 이동해야 합니다.
          이 파일이 없는 위치에서 실행하면 오류가 발생합니다.
        </p>
        <CmdBlock rows={[
          { label: "폴더 이동", cmd: "cd loadtest-converter", desc: "레포를 클론한 경로에 따라 절대 경로를 사용해도 됩니다" },
          { label: "파일 확인", cmd: "ls",                    desc: "docker-compose.yml 파일이 보이면 올바른 위치입니다" },
        ]} />
        <CompareCols
          left={{
            label: "❌ 잘못된 위치",
            lines: [
              { text: "-- 상위 폴더에서 실행", comment: true },
              { text: "$ docker-compose up -d" },
              { text: "ERROR: no configuration file" },
            ],
          }}
          right={{
            label: "✅ 올바른 위치",
            lines: [
              { text: "-- loadtest-converter/ 안에서", comment: true },
              { text: "$ ls" },
              { text: "docker-compose.yml ..." },
            ],
          }}
        />
      </Section>

      <Section id="sd-run" num="03" title="서버 실행">
        <p className="td-text">
          <code>-d</code> 플래그는 <strong>백그라운드(detached)</strong> 모드로 실행한다는 의미입니다.
          터미널을 닫아도 서버가 계속 동작합니다.
        </p>
        <CmdBlock rows={[
          { label: "실행",      cmd: "docker-compose up -d",   desc: "이미지가 없으면 자동으로 pull 후 컨테이너를 생성합니다" },
          { label: "상태 확인", cmd: "docker-compose ps",      desc: "State가 Up이면 정상 실행 중입니다" },
          { label: "로그 확인", cmd: "docker-compose logs -f", desc: "Ctrl+C로 로그 스트림을 종료할 수 있습니다" },
        ]} />
        <InfoGrid rows={[
          ["접속 주소",    "http://localhost:8090  (오케스트레이터 API)"],
          ["포트 충돌 시", "docker-compose.yml의 ports 항목에서 호스트 포트를 변경하세요"],
        ]} />
      </Section>

      <Section id="sd-stop" num="04" title="정지 vs 종료 — 차이를 알자">
        <p className="td-text">
          <strong>stop</strong>은 컨테이너를 멈추지만 유지하고,
          <strong> down</strong>은 완전히 삭제합니다.
        </p>
        <CompareCols
          left={{
            label: "docker-compose stop — 컨테이너 유지",
            lines: [
              { text: "docker-compose stop" },
              { text: "# 컨테이너는 남아있음", comment: true },
              { text: "docker-compose start  # 재개" },
              { text: "# 데이터·설정 보존됨", comment: true },
            ],
          }}
          right={{
            label: "docker-compose down — 컨테이너 삭제",
            lines: [
              { text: "docker-compose down" },
              { text: "# 컨테이너 삭제됨", comment: true },
              { text: "docker-compose up -d  # 새로 생성" },
              { text: "# 볼륨은 기본 유지됨", comment: true },
            ],
          }}
        />
        <InfoGrid rows={[
          ["down -v",    "docker-compose down -v  →  볼륨까지 삭제 (DB 데이터 초기화)"],
          ["언제 down?", "설정 변경·이미지 업데이트 후 완전히 새로 시작할 때"],
        ]} />
      </Section>

      <Section id="sd-restart" num="05" title="재시작">
        <p className="td-text">
          설정 파일을 수정했거나 컨테이너가 비정상 상태일 때 재시작합니다.
        </p>
        <CmdBlock rows={[
          { label: "재시작",        cmd: "docker-compose restart",                      desc: "실행 중인 컨테이너를 그대로 재시작합니다" },
          { label: "설정 반영",     cmd: "docker-compose down && docker-compose up -d", desc: "docker-compose.yml 변경사항을 반영합니다" },
          { label: "특정 서비스만", cmd: "docker-compose restart server",               desc: "서비스 이름을 지정하면 해당 컨테이너만 재시작합니다" },
        ]} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   입문-2. 부하테스트 설정
══════════════════════════════════════════════════════════════════════════ */
function LoadtestContent({ onStartTour, onOpenInVisual }) {
  const ltNodes = [
    { id: "lt-node-1", type: "k6", name: "지갑 초기화", sub: "total_requests=1", detail: "DELETE /wallet/1/reset" },
    { id: "lt-node-2", type: "k6", name: "잔액 충전",   sub: "rps=10 · 30s",    detail: "POST /wallet/1/deposit" },
  ];

  return (
    <div className="td-sections">
      <div className="sd-intro-bar">
        <p className="td-text">
          VU 수, RPS, Duration 등 <strong>부하 파라미터</strong>를 설정하는 방법과
          3가지 부하 모드(rps / total_requests / burst)를 상황에 맞게 선택하는 기준을 익힙니다.
        </p>
        <button className="btn-secondary sd-tour-btn" onClick={onStartTour}>
          🎯 가이드 스텝 시작
        </button>
      </div>

      <MockFlowSection
        id="lt-visual"
        hint="reset → deposit 2-step 시나리오 — RPS 모드 예시"
        nodes={ltNodes}
        openLabel="RPS 모드 예시로 Visual 탭 열기"
        onOpen={onOpenInVisual}
      />

      <Section id="lt-modes" num="01" title="부하 모드 3종 비교">
        <h2 className="td-section-title">상황에 따라 모드를 선택하세요</h2>
        <InfoGrid rows={[
          ["rps",            "초당 N건 유지 · duration 동안 지속 — 지속 부하 · 처리량 측정에 적합"],
          ["total_requests", "정확히 N건만 보내고 종료 — 초기화·단발 요청·재현 가능한 테스트에 사용"],
          ["burst",          "vus명이 동시에 1건씩 — 순간 최대 동시 처리 · Lock 충돌 재현에 사용"],
        ]} />
        <div className="td-compare">
          <div className="td-compare-col bad">
            <div className="td-compare-label bad">⚡ burst — 동시 30건</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- vus=30, totalRequests=30</span></div>
              <div className="td-code-line">30명이 동시에 1번씩 발사</div>
              <div className="td-code-line td-code-muted">→ 락 충돌·Race Condition 재현</div>
              <div className="td-code-total bad">순간 최대 부하</div>
            </div>
          </div>
          <div className="td-compare-arrow">→</div>
          <div className="td-compare-col good">
            <div className="td-compare-label good">📊 rps — 지속 부하</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- vus=5, rps=10, duration=30s</span></div>
              <div className="td-code-line">30초간 초당 10건 유지</div>
              <div className="td-code-line td-code-muted">→ 처리량·레이턴시 프로파일</div>
              <div className="td-code-total good">총 약 300건 처리</div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="lt-form" num="02" title="Form 탭 설정 순서">
        <h2 className="td-section-title">k6 스텝의 부하 파라미터 설정 방법</h2>
        <CmdBlock rows={[
          { label: "① 스텝 추가",   cmd: "+ Add Step → k6",               desc: "스텝 종류를 k6로 선택합니다" },
          { label: "② baseUrl",     cmd: "http://localhost:8080",          desc: "API 서버 주소. 모든 action 경로의 기준이 됩니다" },
          { label: "③ Load Mode",   cmd: "rps / total_requests / burst",   desc: "상황에 맞는 모드를 선택합니다" },
          { label: "④ VUs",         cmd: "5",                              desc: "동시 가상 사용자 수 — rps 요청을 분산하는 워커입니다" },
          { label: "⑤ RPS / Count", cmd: "rps: 10  또는  count: 100",     desc: "rps=초당 건수, total_requests=총 건수" },
          { label: "⑥ Duration",    cmd: "30s",                           desc: "rps 모드에서만 사용. burst·total_requests는 완료 시 자동 종료" },
        ]} />
        <InfoGrid rows={[
          ["VU vs RPS",     "VU는 워커 수, RPS는 목표 처리량. VU가 너무 적으면 RPS 달성이 불가합니다"],
          ["duration 생략", "total_requests·burst 모드에서 duration 필드는 무시됩니다"],
          ["maxDuration",   "burst 모드 전체 완료 제한 시간 (기본 10s). 초과 시 강제 종료"],
        ]} />
      </Section>

      <Section id="lt-action" num="03" title="Action 설정 — HTTP 요청 구성">
        <h2 className="td-section-title">스텝 안에 HTTP 요청을 추가합니다</h2>
        <CmdBlock rows={[
          { label: "Method",  cmd: "GET / POST / PUT / DELETE / PATCH",  desc: "HTTP 메서드 선택" },
          { label: "Path",    cmd: "/wallet/1/deposit",                  desc: "baseUrl에 붙는 경로. ${var} 변수 치환 가능" },
          { label: "Body",    cmd: '{ "amount": 1000 }',                 desc: "POST·PUT·PATCH 요청의 JSON 바디" },
          { label: "Extract", cmd: "balance ← $.balance",               desc: "응답 JSON에서 값을 추출해 다음 action에서 재사용" },
        ]} />
        <CompareCols
          left={{
            label: "❌ path에 userId 하드코딩",
            lines: [
              { text: "-- 모든 VU가 같은 userId=1", comment: true },
              { text: "POST /wallet/1/deposit" },
              { text: "-- 1번 지갑만 계속 충전됨", comment: true },
              { text: "-- 동시 쓰기 충돌 발생", comment: true },
            ],
          }}
          right={{
            label: "✅ users.csv 변수 사용",
            lines: [
              { text: "-- VU별 다른 userId", comment: true },
              { text: "POST /wallet/${users.userId}/deposit" },
              { text: "-- 각자의 지갑에 독립 충전", comment: true },
              { text: "-- 충돌 없이 정확한 결과", comment: true },
            ],
          }}
        />
      </Section>

      <Section id="lt-example" num="04" title="실제 설정 예시 — reset + deposit">
        <h2 className="td-section-title">2-step 시나리오로 RPS 모드를 확인합니다</h2>
        <InfoGrid rows={[
          ["Step 1 — reset",   "loadMode=total_requests, totalRequests=1, DELETE /wallet/1/reset"],
          ["Step 2 — deposit", "loadMode=rps, vus=5, rps=10, duration=30s, POST /wallet/1/deposit, body: {amount:1000}"],
          ["depends_on",       "deposit 스텝에 depends_on: [lt-01-reset] — 초기화 완료 후 실행 보장"],
          ["결과 확인",        "30초 후 잔액이 10(rps) × 30(s) × 1000(amount) = 300,000원에 수렴하면 정상"],
        ]} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   입문-3. 파라미터와 유저 정보 설정
══════════════════════════════════════════════════════════════════════════ */
function ParamsUsersContent({ onStartTour, onOpenVisualParams, onOpenVisualUsers }) {
  const paramsNodes = [
    { id: "pu-node-params-1", type: "k6", name: "결제 초기화",  sub: "total_requests=1",    detail: "DELETE /payment/reset" },
    { id: "pu-node-params-2", type: "k6", name: "VU별 결제",    sub: "rps=5 · params.json", detail: "POST /payment/pay" },
  ];
  const usersNodes = [
    { id: "pu-node-users-1",  type: "k6", name: "지갑 전체 초기화", sub: "total_requests=1",   detail: "DELETE /wallet/reset-all" },
    { id: "pu-node-users-2",  type: "k6", name: "사용자별 충전",    sub: "rps=5 · users.csv",  detail: "POST /wallet/${users.userId}/deposit" },
  ];

  return (
    <div className="td-sections">
      <div className="sd-intro-bar">
        <p className="td-text">
          <strong>params.json</strong>은 VU별 <em>요청 파라미터(body 값)</em>를,
          <strong> users.csv</strong>는 VU별 <em>사용자 신원 정보</em>를 주입합니다.
          언제 어떤 것을 쓰는지 예시로 익힙니다.
        </p>
        <button className="btn-secondary sd-tour-btn" onClick={onStartTour}>
          🎯 가이드 스텝 시작
        </button>
      </div>

      {/* ── params.json Visual ── */}
      <MockFlowSection
        id="pu-visual-params"
        hint="params.json 예시 — VU별 다른 idempotencyKey로 독립 결제"
        nodes={paramsNodes}
        openLabel="params.json 예시로 Visual 탭 열기"
        onOpen={onOpenVisualParams}
      />

      <Section id="pu-params" num="01" title="params.json — 요청 파라미터 분리">
        <h2 className="td-section-title">VU마다 다른 값을 body에 넣을 때 사용합니다</h2>
        <p className="td-text">
          멱등성 키, 상품 ID, 쿠폰 코드처럼 <strong>VU마다 달라야 하는 요청 바디 값</strong>을
          params.json에 정의합니다. round_robin 전략으로 VU에 순환 할당됩니다.
        </p>
        <div className="td-code" style={{ borderRadius: 6, padding: "12px 16px" }}>
          <div className="td-code-line"><span className="td-code-comment">// params.json 예시</span></div>
          <div className="td-code-line">{"["}</div>
          <div className="td-code-line">&nbsp;&nbsp;{"{ \"idempotencyKey\": \"pay-vu1-001\", \"amount\": 5000 },"}</div>
          <div className="td-code-line">&nbsp;&nbsp;{"{ \"idempotencyKey\": \"pay-vu2-001\", \"amount\": 5000 },"}</div>
          <div className="td-code-line">&nbsp;&nbsp;{"{ \"idempotencyKey\": \"pay-vu3-001\", \"amount\": 5000 }"}</div>
          <div className="td-code-line">{"]"}</div>
        </div>
        <InfoGrid rows={[
          ["Form 설정",  "Params 탭 → 파일 업로드 → mode: rows, strategy: round_robin"],
          ["body 참조",  '{"idempotencyKey": "${params.idempotencyKey}", "amount": 5000}'],
          ["행 개수",    "VU 수보다 적어도 됩니다. 부족하면 처음부터 순환(round_robin)합니다"],
          ["언제 씀?",   "key·code처럼 요청 body 안에 들어가는 값이 VU마다 달라야 할 때"],
        ]} />
      </Section>

      <Section id="pu-params-example" num="02" title="params.json 예시 — VU별 결제">
        <h2 className="td-section-title">idempotencyKey를 VU마다 다르게 설정합니다</h2>
        <CompareCols
          left={{
            label: "❌ 모든 VU가 같은 key 사용",
            lines: [
              { text: '{ "idempotencyKey": "pay-001" }' },
              { text: "-- 첫 번째 VU만 결제 성공", comment: true },
              { text: "-- 나머지는 중복 결제 차단됨", comment: true },
              { text: "-- 부하 테스트 의미 없어짐", comment: true },
            ],
          }}
          right={{
            label: "✅ params.json으로 VU별 고유 key",
            lines: [
              { text: '{ "idempotencyKey": "${params.idempotencyKey}" }' },
              { text: "-- VU1: pay-vu1-001", comment: true },
              { text: "-- VU2: pay-vu2-001", comment: true },
              { text: "-- 각 VU 독립 결제 → 정확한 부하", comment: true },
            ],
          }}
        />
        <InfoGrid rows={[
          ["Step 구성", "reset (total_requests=1) → pay (rps=5, duration=20s, params.json 업로드)"],
          ["결과 검증", "confirmCount = vus × duration_s × rps 이면 중복 없이 처리 완료"],
        ]} />
      </Section>

      {/* ── users.csv Visual ── */}
      <MockFlowSection
        id="pu-visual-users"
        hint="users.csv 예시 — VU별 다른 사용자 지갑에 독립 충전"
        nodes={usersNodes}
        openLabel="users.csv 예시로 Visual 탭 열기"
        onOpen={onOpenVisualUsers}
      />

      <Section id="pu-users" num="03" title="users.csv — 사용자 신원 정보 분리">
        <h2 className="td-section-title">VU마다 다른 사용자 ID·로그인 정보를 줄 때 사용합니다</h2>
        <p className="td-text">
          userId, loginId, password처럼 <strong>VU가 어떤 사용자인지</strong>를 정의합니다.
          각 VU는 CSV의 한 행을 독점해 다른 사용자와 완전히 격리됩니다.
        </p>
        <div className="td-code" style={{ borderRadius: 6, padding: "12px 16px" }}>
          <div className="td-code-line"><span className="td-code-comment">-- users.csv 예시</span></div>
          <div className="td-code-line">userId,loginId,password</div>
          <div className="td-code-line">1,user1,pass1</div>
          <div className="td-code-line">2,user2,pass2</div>
          <div className="td-code-line">3,user3,pass3</div>
          <div className="td-code-line">4,user4,pass4</div>
          <div className="td-code-line">5,user5,pass5</div>
        </div>
        <InfoGrid rows={[
          ["Form 설정",  "Users 탭 → 파일 업로드 → authType: none (인증 없이 식별만 할 때)"],
          ["path 참조",  "/wallet/${users.userId}/deposit — 경로에도 변수 사용 가능"],
          ["body 참조",  '{"ownerId": "${users.userId}"}'],
          ["언제 씀?",   "URL 경로나 body에 userId가 들어가거나, VU별 로그인이 필요할 때"],
        ]} />
      </Section>

      <Section id="pu-users-example" num="04" title="users.csv 예시 — 사용자별 독립 지갑 충전">
        <h2 className="td-section-title">각 VU가 자신의 지갑에만 충전합니다</h2>
        <CompareCols
          left={{
            label: "❌ 하드코딩 userId=1",
            lines: [
              { text: "POST /wallet/1/deposit" },
              { text: "-- 5 VU 모두 지갑 1번에 충전", comment: true },
              { text: "-- 동시 쓰기 충돌 발생 가능", comment: true },
              { text: "-- 독립 검증 불가", comment: true },
            ],
          }}
          right={{
            label: "✅ users.csv userId 참조",
            lines: [
              { text: "POST /wallet/${users.userId}/deposit" },
              { text: "-- VU1→지갑1, VU2→지갑2 ...", comment: true },
              { text: "-- 각자 독립 → 충돌 없음", comment: true },
              { text: "-- 지갑별 balance 검증 가능", comment: true },
            ],
          }}
        />
        <InfoGrid rows={[
          ["Step 구성",      "reset-all (total_requests=1) → deposit (rps=5, duration=20s, users.csv 업로드)"],
          ["params vs users", "params = body 값 분리 / users = 사용자 신원 분리. 동시 사용도 가능"],
          ["auth step 연계", "loginId·password 컬럼을 추가하면 auth step과 연계해 로그인 기반 테스트 가능"],
        ]} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   driver.js 투어 훅
══════════════════════════════════════════════════════════════════════════ */
function useContainerTour() {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "다음 →",
      prevBtnText: "← 이전",
      doneBtnText: "✓ 완료",
      progressText: "{{current}} / {{total}}",
      popoverClass: "lc-tour-popover",
      overlayOpacity: 0.82,
      smoothScroll: true,
      scrollPadding: 24,
      steps: [
        {
          popover: {
            title: "🐳 컨테이너 제어 가이드",
            description:
              "Docker Compose로 서버를 <strong>실행·정지·재시작·종료</strong>하는 흐름을<br>" +
              "6개 스텝으로 나눠서 단계별로 안내합니다.",
          },
        },
        {
          element: "#sd-visual",
          popover: {
            title: "🔗 Visual 탭 구성",
            description:
              "이 6개 노드가 <strong>Visual 탭</strong>에서 어떻게 보이는지 미리 확인할 수 있습니다.<br>" +
              "<b>Visual 탭에서 직접 열기</b> 버튼을 누르면 이 스텝들이 자동으로 로드됩니다.",
            side: "bottom",
          },
        },
        {
          element: "#sd-node-1",
          popover: {
            title: "Step 1 — 폴더 이동",
            description:
              "<code>cd loadtest-converter</code><br><br>" +
              "<code>docker-compose.yml</code>이 있는 폴더에서 실행해야 합니다.<br>" +
              "잘못된 위치에서 실행하면 <em>no configuration file</em> 오류가 납니다.",
            side: "bottom",
          },
        },
        {
          element: "#sd-node-2",
          popover: {
            title: "Step 2 — 버전 확인",
            description:
              "<code>docker --version && docker-compose --version</code><br><br>" +
              "<code>&&</code>로 두 명령어를 한 스텝에 묶어 순서대로 실행합니다.<br>" +
              "버전 정보가 출력되면 설치 완료입니다.",
            side: "bottom",
          },
        },
        {
          element: "#sd-node-3",
          popover: {
            title: "Step 3 — 서버 실행",
            description:
              "<code>docker-compose up -d</code><br><br>" +
              "<code>-d</code> 플래그로 <strong>백그라운드</strong>에서 실행합니다.<br>" +
              "실행 후 <code>docker-compose ps</code>로 State가 <em>Up</em>인지 확인하세요.",
            side: "bottom",
          },
        },
        {
          element: "#sd-node-4",
          popover: {
            title: "Step 4 — 서버 정지",
            description:
              "<code>docker-compose stop</code><br><br>" +
              "<b>stop</b>은 컨테이너를 멈추지만 삭제하지 않습니다.<br>" +
              "<code>docker-compose start</code>로 다시 재개할 수 있습니다.",
            side: "bottom",
          },
        },
        {
          element: "#sd-node-5",
          popover: {
            title: "Step 5 — 재시작",
            description:
              "<code>docker-compose restart</code><br><br>" +
              "실행 중인 컨테이너를 그대로 재시작합니다.<br>" +
              "설정 변경을 반영하려면 <b>down → up -d</b> 순서를 사용하세요.",
            side: "bottom",
          },
        },
        {
          element: "#sd-node-6",
          popover: {
            title: "Step 6 — 종료",
            description:
              "<code>docker-compose down</code><br><br>" +
              "컨테이너를 삭제합니다. 볼륨은 기본적으로 유지됩니다.<br>" +
              "볼륨까지 삭제하려면 <code>docker-compose down -v</code>를 사용하세요.",
            side: "bottom",
          },
        },
        {
          element: "#sd-prereq",
          popover: {
            title: "📋 상세 설명 섹션",
            description:
              "아래 01~05 섹션에서 각 단계의 <strong>상세 설명과 비교 예시</strong>를 확인할 수 있습니다.<br>" +
              "처음 설정한다면 01번부터 순서대로 따라 해보세요.",
            side: "top",
          },
        },
      ],
    });
    driverObj.drive();
  }, []);

  return { startTour };
}

function useLoadtestTour() {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "다음 →",
      prevBtnText: "← 이전",
      doneBtnText: "✓ 완료",
      progressText: "{{current}} / {{total}}",
      popoverClass: "lc-tour-popover",
      overlayOpacity: 0.82,
      smoothScroll: true,
      scrollPadding: 24,
      steps: [
        {
          popover: {
            title: "⚙️ 부하테스트 설정 가이드",
            description:
              "VU 수, RPS, Duration을 설정하고<br>" +
              "<strong>rps / total_requests / burst</strong> 세 가지 모드를 익힙니다.",
          },
        },
        {
          element: "#lt-visual",
          popover: {
            title: "🔗 Visual 탭 구성 — RPS 모드 예시",
            description:
              "reset(초기화) → deposit(충전) 2개 k6 스텝으로 구성됩니다.<br>" +
              "두 번째 스텝이 <strong>RPS 모드</strong>로 설정된 예시입니다.",
            side: "bottom",
          },
        },
        {
          element: "#lt-node-1",
          popover: {
            title: "Step 1 — 지갑 초기화",
            description:
              "<code>DELETE /wallet/1/reset</code><br><br>" +
              "<strong>total_requests=1</strong>로 설정해 딱 1번만 실행합니다.<br>" +
              "테스트 전 상태를 항상 동일하게 만드는 용도입니다.",
            side: "bottom",
          },
        },
        {
          element: "#lt-node-2",
          popover: {
            title: "Step 2 — 잔액 충전 (RPS 모드)",
            description:
              "<code>POST /wallet/1/deposit</code><br><br>" +
              "<strong>rps=10, vus=5, duration=30s</strong> — 초당 10건을 30초간 유지합니다.<br>" +
              "depends_on: [lt-01-reset]으로 Step 1이 완료된 후 실행됩니다.",
            side: "bottom",
          },
        },
        {
          element: "#lt-modes",
          popover: {
            title: "01 — 부하 모드 3종",
            description:
              "<b>rps</b>: 지속 부하 · <b>total_requests</b>: 정확한 건수 · <b>burst</b>: 동시 최대 부하<br><br>" +
              "시나리오 목적에 따라 선택하세요.",
            side: "top",
          },
        },
        {
          element: "#lt-form",
          popover: {
            title: "02 — Form 탭 설정 순서",
            description:
              "k6 스텝 추가 후 <b>Load Mode → VUs → RPS/Count → Duration</b> 순서로 설정합니다.<br>" +
              "baseUrl은 모든 action의 기준 경로입니다.",
            side: "top",
          },
        },
        {
          element: "#lt-action",
          popover: {
            title: "03 — Action 설정",
            description:
              "HTTP Method, Path, Body, Extract를 설정합니다.<br>" +
              "Path에 <code>${users.userId}</code> 같은 변수를 사용할 수 있습니다.",
            side: "top",
          },
        },
      ],
    });
    driverObj.drive();
  }, []);

  return { startTour };
}

function useParamsUsersTour() {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "다음 →",
      prevBtnText: "← 이전",
      doneBtnText: "✓ 완료",
      progressText: "{{current}} / {{total}}",
      popoverClass: "lc-tour-popover",
      overlayOpacity: 0.82,
      smoothScroll: true,
      scrollPadding: 24,
      steps: [
        {
          popover: {
            title: "👤 파라미터 & 유저 설정 가이드",
            description:
              "<strong>params.json</strong>은 VU별 요청 파라미터,<br>" +
              "<strong>users.csv</strong>는 VU별 사용자 신원 정보를 주입합니다.",
          },
        },
        {
          element: "#pu-visual-params",
          popover: {
            title: "🔗 params.json Visual 예시",
            description:
              "결제 시 VU마다 다른 <strong>idempotencyKey</strong>를 params.json으로 주입합니다.<br>" +
              "버튼을 누르면 이 시나리오가 Visual 탭에 로드됩니다.",
            side: "bottom",
          },
        },
        {
          element: "#pu-node-params-2",
          popover: {
            title: "params.json 스텝",
            description:
              "<code>POST /payment/pay</code><br><br>" +
              "body에서 <code>${params.idempotencyKey}</code>를 참조합니다.<br>" +
              "VU마다 다른 키로 독립적인 결제를 수행합니다.",
            side: "bottom",
          },
        },
        {
          element: "#pu-params",
          popover: {
            title: "01 — params.json 설명",
            description:
              "JSON 배열 파일을 업로드하고,<br>" +
              "body에서 <code>${params.필드명}</code>으로 참조합니다.",
            side: "top",
          },
        },
        {
          element: "#pu-visual-users",
          popover: {
            title: "🔗 users.csv Visual 예시",
            description:
              "VU별 다른 <strong>userId</strong>로 각자의 지갑에 독립 충전합니다.<br>" +
              "버튼을 누르면 이 시나리오가 Visual 탭에 로드됩니다.",
            side: "bottom",
          },
        },
        {
          element: "#pu-node-users-2",
          popover: {
            title: "users.csv 스텝",
            description:
              "<code>POST /wallet/${users.userId}/deposit</code><br><br>" +
              "경로에서 <code>${users.userId}</code>를 참조합니다.<br>" +
              "VU마다 다른 지갑에 독립 충전됩니다.",
            side: "bottom",
          },
        },
        {
          element: "#pu-users",
          popover: {
            title: "03 — users.csv 설명",
            description:
              "CSV 헤더 컬럼명을 <code>${users.컬럼명}</code>으로 참조합니다.<br>" +
              "loginId·password를 포함하면 auth step과 연계할 수 있습니다.",
            side: "top",
          },
        },
      ],
    });
    driverObj.drive();
  }, []);

  return { startTour };
}

/* ══════════════════════════════════════════════════════════════════════════
   세팅 가이드 메타
══════════════════════════════════════════════════════════════════════════ */
const SETUP_PAGES = {
  "setup-container": {
    num: 1, emoji: "🐳", title: "컨테이너 제어", subtitle: "입문-1",
    difficulty: "easy", tags: ["Docker", "Docker Compose", "컨테이너"],
    hasTour: true, hasVisual: true,
    ctaHint: "Visual 탭에서 열기를 누르면 6개 command step이 자동으로 로드됩니다. 노드를 클릭하면 오른쪽 패널에서 명령어를 직접 편집할 수 있습니다.",
  },
  "setup-loadtest": {
    num: 2, emoji: "⚙️", title: "부하테스트 설정", subtitle: "입문-2",
    difficulty: "easy", tags: ["VU", "Duration", "RPS", "부하 설정"],
    hasTour: true, hasVisual: true,
    ctaHint: "RPS 모드 2-step 시나리오가 로드됩니다. Load Mode 드롭다운을 바꿔가며 rps / total_requests / burst 차이를 직접 확인해보세요.",
  },
  "setup-params-users": {
    num: 3, emoji: "👤", title: "파라미터와 유저 정보 설정", subtitle: "입문-3",
    difficulty: "easy", tags: ["params.json", "users.csv", "VU 분리"],
    hasTour: true, hasVisual: true,
    ctaHint: "params.json 예시(VU별 결제)와 users.csv 예시(사용자별 지갑 충전)를 각각 Visual 탭에서 열어볼 수 있습니다.",
  },
};

const DIFF_LABEL = {
  easy:   { label: "입문", color: "#3fb950" },
  medium: { label: "중급", color: "#e3b341" },
  hard:   { label: "고급", color: "#f85149" },
};

/* ══════════════════════════════════════════════════════════════════════════
   라우터 진입점
══════════════════════════════════════════════════════════════════════════ */
export default function SetupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setMeta, setSteps } = useScenario();

  const { startTour: startContainerTour } = useContainerTour();
  const { startTour: startLoadtestTour }  = useLoadtestTour();
  const { startTour: startParamsTour }    = useParamsUsersTour();

  const page = SETUP_PAGES[id];

  /* ── Visual 탭 열기 핸들러 ── */
  const handleOpenContainer = useCallback(() => {
    setMeta({ name: "컨테이너 제어", description: "Docker Compose 컨테이너 제어 시퀀스" });
    setSteps(DOCKER_STEPS.map((s) => ({ ...newStep(), ...s })));
    navigate("/flow");
  }, [setMeta, setSteps, navigate]);

  const handleOpenLoadtest = useCallback(() => {
    setMeta({ name: "부하테스트 RPS 예시", description: "reset → deposit RPS 모드 2-step 시나리오" });
    setSteps(LOADTEST_STEPS.map((s) => ({ ...newStep(), ...s })));
    navigate("/flow");
  }, [setMeta, setSteps, navigate]);

  const handleOpenParams = useCallback(() => {
    setMeta({ name: "params.json 예시", description: "VU별 결제 — idempotencyKey 분리" });
    setSteps(PARAMS_STEPS.map((s) => ({ ...newStep(), ...s })));
    navigate("/flow");
  }, [setMeta, setSteps, navigate]);

  const handleOpenUsers = useCallback(() => {
    setMeta({ name: "users.csv 예시", description: "사용자별 독립 지갑 충전" });
    setSteps(USERS_STEPS.map((s) => ({ ...newStep(), ...s })));
    navigate("/flow");
  }, [setMeta, setSteps, navigate]);

  if (!page) {
    return (
      <div className="tutorial-detail-empty">
        <p>가이드를 찾을 수 없습니다.</p>
        <button className="btn-ghost" onClick={() => navigate("/tutorial")}>← 목록으로</button>
      </div>
    );
  }

  const diff = DIFF_LABEL[page.difficulty];

  const tourFn = id === "setup-container" ? startContainerTour
               : id === "setup-loadtest"   ? startLoadtestTour
               : startParamsTour;

  const renderContent = () => {
    switch (id) {
      case "setup-container":
        return <ContainerControlContent onStartTour={startContainerTour} onOpenInVisual={handleOpenContainer} />;
      case "setup-loadtest":
        return <LoadtestContent onStartTour={startLoadtestTour} onOpenInVisual={handleOpenLoadtest} />;
      case "setup-params-users":
        return <ParamsUsersContent onStartTour={startParamsTour} onOpenVisualParams={handleOpenParams} onOpenVisualUsers={handleOpenUsers} />;
      default:
        return null;
    }
  };

  return (
    <div className="tutorial-detail-page">
      {/* ── 헤더 ── */}
      <div className="td-header">
        <Link to="/tutorial" className="td-back">← 세팅 가이드</Link>
        <div className="td-title-row">
          <span className="td-emoji">{page.emoji}</span>
          <div>
            <div className="td-title">{page.subtitle}. {page.title}</div>
            <div className="td-meta">
              <span className="td-subtitle">세팅 가이드</span>
              <span className="tutorial-card-difficulty" style={{ color: diff.color, borderColor: diff.color }}>
                {diff.label}
              </span>
              {page.tags.map((t) => <span key={t} className="tutorial-tag">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="td-body">{renderContent()}</div>

      {/* ── CTA ── */}
      <div className="td-cta">
        <div className="td-cta-buttons">
          {id === "setup-container" && (
            <button className="btn-primary td-cta-main" onClick={handleOpenContainer}>
              🔗 Visual 탭에서 열기
            </button>
          )}
          {id === "setup-loadtest" && (
            <button className="btn-primary td-cta-main" onClick={handleOpenLoadtest}>
              🔗 RPS 예시 Visual 탭에서 열기
            </button>
          )}
          {id === "setup-params-users" && (
            <>
              <button className="btn-primary td-cta-main" onClick={handleOpenParams}>
                🔗 params.json 예시 열기
              </button>
              <button className="btn-primary td-cta-main" onClick={handleOpenUsers}>
                🔗 users.csv 예시 열기
              </button>
            </>
          )}
          <button className="btn-secondary td-cta-sub" onClick={() => navigate("/")}>
            📝 Form에서 시작하기
          </button>
          <button className="btn-ghost td-cta-sub" onClick={tourFn}>
            🎯 가이드 스텝 다시 보기
          </button>
          <Link to="/tutorial" className="btn-ghost td-cta-sub">
            ← 목록으로
          </Link>
        </div>
        <p className="td-cta-hint">{page.ctaHint}</p>
      </div>
    </div>
  );
}
