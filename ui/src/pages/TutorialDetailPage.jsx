import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useScenario, newStep } from "../context/ScenarioContext.jsx";
import { importScenario } from "../api/convertApi.js";

/* ══════════════════════════════════════════════════════════════════════════
   시나리오 YAML
══════════════════════════════════════════════════════════════════════════ */
const SCENARIO_YAML = {
  "n-plus-one": `
name: N+1 쿼리 문제 시연
steps:
  - id: lazy-load
    name: "[나쁜] Lazy 로딩 (N+1 쿼리)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 5
    duration: 15s
    actions:
      - id: get-posts-lazy
        method: GET
        path: /post/list-lazy
  - id: fetch-join
    name: "[좋은] Fetch Join (1 쿼리)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 5
    duration: 15s
    actions:
      - id: get-posts-fetch
        method: GET
        path: /post/list-fetch
`.trim(),

  "stock-concurrency": `
name: 재고 차감 — 동시성 미보호 (Race Condition)
steps:
  - id: reset
    name: 재고 초기화 (10개)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-product
        method: POST
        path: /product/1/reset
  - id: burst-purchase
    name: "[나쁜] 동시 구매 30건 (락 없음)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 30
    duration: 10s
    extra:
      total_requests: 30
    actions:
      - id: purchase-unsafe
        method: POST
        path: /product/1/purchase-unsafe
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [burst-purchase]
    base_url: http://localhost:8080
    checks:
      - id: check-stock
        method: GET
        path: /product/1
        assert:
          status: 200
          json:
            "$.data.stock": "0"
            "$.data.successCount": "10"
`.trim(),

  "stock-lock": `
name: 재고 차감 — 비관적 락 (Pessimistic Lock)
steps:
  - id: reset
    name: 재고 초기화 (10개)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-product
        method: POST
        path: /product/1/reset
  - id: burst-purchase
    name: "[좋은] 동시 구매 30건 (비관적 락)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 30
    duration: 10s
    extra:
      total_requests: 30
    actions:
      - id: purchase-lock
        method: POST
        path: /product/1/purchase-lock
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [burst-purchase]
    base_url: http://localhost:8080
    checks:
      - id: check-stock
        method: GET
        path: /product/1
        assert:
          status: 200
          json:
            "$.data.stock": "0"
            "$.data.successCount": "10"
`.trim(),

  "wallet-lost-update": `
name: 잔액 충전 — 동시성 미보호 (Lost Update)
steps:
  - id: reset
    name: 지갑 초기화 (10,000원)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-wallet
        method: POST
        path: /wallet/1/reset
  - id: burst-deposit
    name: "[나쁜] 동시 충전 30건 (락 없음)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 30
    duration: 10s
    extra:
      total_requests: 30
    actions:
      - id: deposit-unsafe
        method: POST
        path: /wallet/1/deposit-unsafe
        body:
          amount: 1000
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [burst-deposit]
    base_url: http://localhost:8080
    checks:
      - id: check-balance
        method: GET
        path: /wallet/1
        assert:
          status: 200
          json:
            "$.data.balance": "40000"
`.trim(),

  "wallet-pessimistic": `
name: 잔액 충전 — 비관적 락 (Pessimistic Lock)
steps:
  - id: reset
    name: 지갑 초기화 (10,000원)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-wallet
        method: POST
        path: /wallet/1/reset
  - id: burst-deposit
    name: "[좋은] 동시 충전 30건 (비관적 락)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 30
    duration: 10s
    extra:
      total_requests: 30
    actions:
      - id: deposit-pessimistic
        method: POST
        path: /wallet/1/deposit-pessimistic
        body:
          amount: 1000
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [burst-deposit]
    base_url: http://localhost:8080
    checks:
      - id: check-balance
        method: GET
        path: /wallet/1
        assert:
          status: 200
          json:
            "$.data.balance": "40000"
`.trim(),

  "wallet-multiuser": `
name: 다중 사용자 지갑 충전 — 비관적 락
steps:
  - id: reset
    name: 전체 지갑 초기화 (user1~5)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 10s
    extra:
      total_requests: 5
    actions:
      - id: reset-wallet-1
        method: POST
        path: /wallet/1/reset
      - id: reset-wallet-2
        method: POST
        path: /wallet/2/reset
      - id: reset-wallet-3
        method: POST
        path: /wallet/3/reset
      - id: reset-wallet-4
        method: POST
        path: /wallet/4/reset
      - id: reset-wallet-5
        method: POST
        path: /wallet/5/reset
  - id: deposit-multiuser
    name: 사용자별 지갑 충전 (users.csv)
    type: k6
    template: templates/k6_http_actions_cookie_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 5
    duration: 15s
    extra:
      total_requests: 5
    users:
      file: users.csv
      key: userId
      assign: round_robin
      auth:
        type: none
    actions:
      - id: deposit-by-user
        method: POST
        path: /wallet/{{userId}}/deposit-pessimistic
        body:
          amount: 1000
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [deposit-multiuser]
    base_url: http://localhost:8080
    checks:
      - id: check-user1
        method: GET
        path: /wallet/1
        assert:
          status: 200
          json:
            "$.data.balance": "11000"
      - id: check-user2
        method: GET
        path: /wallet/2
        assert:
          status: 200
          json:
            "$.data.balance": "11000"
      - id: check-user3
        method: GET
        path: /wallet/3
        assert:
          status: 200
          json:
            "$.data.balance": "11000"
      - id: check-user4
        method: GET
        path: /wallet/4
        assert:
          status: 200
          json:
            "$.data.balance": "11000"
      - id: check-user5
        method: GET
        path: /wallet/5
        assert:
          status: 200
          json:
            "$.data.balance": "11000"
`.trim(),

  "payment-idempotency": `
name: 멱등성 없는 결제 (Duplicate Payment)
steps:
  - id: burst-payment
    name: "[나쁜] 동시 결제 10건 (멱등성 없음)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 10
    duration: 10s
    extra:
      total_requests: 10
    actions:
      - id: confirm-unsafe
        method: POST
        path: /payment/confirm-unsafe
        body:
          userId: 1
          amount: 5000
          idempotencyKey: "pay-user1-unsafe-001"
`.trim(),

  "payment-idempotent": `
name: 멱등성 보장 결제 (Idempotent Payment)
steps:
  - id: burst-payment
    name: "[좋은] 동시 결제 10건 (멱등성 보장)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 10
    duration: 10s
    extra:
      total_requests: 10
    actions:
      - id: confirm-idempotent
        method: POST
        path: /payment/confirm-idempotent
        body:
          userId: 1
          amount: 5000
          idempotencyKey: "pay-user1-idempotent-001"
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [burst-payment]
    base_url: http://localhost:8080
    checks:
      - id: check-confirm-count
        method: GET
        path: /payment/by-key/pay-user1-idempotent-001
        assert:
          status: 200
          json:
            "$.data.confirmCount": "1"
`.trim(),

  "payment-params": `
name: 멱등성 결제 — params.json 사용자별 키
steps:
  - id: payment-by-params
    name: 사용자별 결제 (params.json)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 5
    duration: 15s
    extra:
      total_requests: 5
    params:
      file: params.json
      assign: round_robin
    actions:
      - id: confirm-by-key
        method: POST
        path: /payment/confirm-idempotent
        body:
          userId: 1
          amount: 5000
          idempotencyKey: "{{idempotencyKey}}"
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [payment-by-params]
    base_url: http://localhost:8080
    checks:
      - id: check-key-1
        method: GET
        path: /payment/by-key/pay-user1-001
        assert:
          status: 200
          json:
            "$.data.confirmCount": "1"
      - id: check-key-2
        method: GET
        path: /payment/by-key/pay-user2-001
        assert:
          status: 200
          json:
            "$.data.confirmCount": "1"
      - id: check-key-3
        method: GET
        path: /payment/by-key/pay-user3-001
        assert:
          status: 200
          json:
            "$.data.confirmCount": "1"
      - id: check-key-4
        method: GET
        path: /payment/by-key/pay-user4-001
        assert:
          status: 200
          json:
            "$.data.confirmCount": "1"
      - id: check-key-5
        method: GET
        path: /payment/by-key/pay-user5-001
        assert:
          status: 200
          json:
            "$.data.confirmCount": "1"
`.trim(),

  "order-no-tx": `
name: 트랜잭션 없음 — 부분 저장 (Partial Write)
steps:
  - id: reset
    name: 주문 데이터 초기화
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-orders
        method: DELETE
        path: /order/reset
  - id: create-orders
    name: "[나쁜] 주문 생성 10건 (트랜잭션 없음)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 30s
    extra:
      total_requests: 10
    actions:
      - id: create-no-tx
        method: POST
        path: /order/create-no-tx
        body:
          userId: 1
          productId: 1
          quantity: 2
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [create-orders]
    base_url: http://localhost:8080
    checks:
      - id: check-orphans
        method: GET
        path: /order/stats
        assert:
          status: 200
          json:
            "$.data.orphanedOrders": "10"
            "$.data.totalOrders": "10"
`.trim(),

  "order-with-tx": `
name: 트랜잭션 보장 — 완전 롤백 (Atomic Rollback)
steps:
  - id: reset
    name: 주문 데이터 초기화
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-orders
        method: DELETE
        path: /order/reset
  - id: create-orders
    name: "[좋은] 주문 생성 10건 (트랜잭션 보장)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 30s
    extra:
      total_requests: 10
    actions:
      - id: create-with-tx
        method: POST
        path: /order/create-with-tx
        body:
          userId: 1
          productId: 1
          quantity: 2
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [create-orders]
    base_url: http://localhost:8080
    checks:
      - id: check-no-data
        method: GET
        path: /order/stats
        assert:
          status: 200
          json:
            "$.data.totalOrders": "0"
            "$.data.orphanedOrders": "0"
`.trim(),

  /* ── 낙관적 락 ── */
  "wallet-optimistic": `
name: 잔액 충전 — 낙관적 락 (Optimistic Lock, 고충돌)
steps:
  - id: reset
    name: 지갑 초기화 (10,000원)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-wallet
        method: POST
        path: /wallet/1/reset
  - id: burst-deposit
    name: "[테스트] 동시 충전 30건 (낙관적 락)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 30
    duration: 10s
    extra:
      total_requests: 30
    actions:
      - id: deposit-optimistic
        method: POST
        path: /wallet/1/deposit-optimistic
        body:
          amount: 1000
  - id: verify
    name: 결과 검증 (409 충돌로 FAIL 가능)
    type: final_check
    depends_on: [burst-deposit]
    base_url: http://localhost:8080
    checks:
      - id: check-balance
        method: GET
        path: /wallet/1
        assert:
          status: 200
          json:
            "$.data.balance": "40000"
`.trim(),

  /* ── 원자적 UPDATE ── */
  "wallet-atomic": `
name: 잔액 충전 — 원자적 UPDATE (Lock-Free)
steps:
  - id: reset
    name: 지갑 초기화 (10,000원)
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 1
    duration: 5s
    extra:
      total_requests: 1
    actions:
      - id: reset-wallet
        method: POST
        path: /wallet/1/reset
  - id: burst-deposit
    name: "[좋은] 동시 충전 30건 (원자적 UPDATE)"
    type: k6
    template: templates/k6_http_get_no_auth.js.tmpl
    flow: sequential
    base_url: http://localhost:8080
    vus: 30
    duration: 10s
    extra:
      total_requests: 30
    actions:
      - id: deposit-atomic
        method: POST
        path: /wallet/1/deposit-atomic
        body:
          amount: 1000
  - id: verify
    name: 결과 검증
    type: final_check
    depends_on: [burst-deposit]
    base_url: http://localhost:8080
    checks:
      - id: check-balance
        method: GET
        path: /wallet/1
        assert:
          status: 200
          json:
            "$.data.balance": "40000"
`.trim(),

  /* ── auth 로그인 흐름 ── */
  "auth-login-flow": `
name: 로그인 기반 인증 흐름
steps:
  - id: pre-login
    name: VU별 사전 로그인 (auth step)
    type: auth
    base_url: http://localhost:8080
    users:
      file: users.csv
      auth:
        type: cookie
        login:
          method: POST
          path: /auth/login
          cookieName: userId
  - id: authenticated-load
    name: 인증 기반 부하 테스트
    type: k6
    template: templates/k6_http_actions_cookie_auth.js.tmpl
    depends_on: [pre-login]
    flow: sequential
    base_url: http://localhost:8080
    vus: 5
    duration: 15s
    actions:
      - id: get-me
        method: GET
        path: /auth/me
  - id: verify
    name: 인증 상태 검증
    type: final_check
    depends_on: [authenticated-load]
    base_url: http://localhost:8080
    checks:
      - id: check-auth
        method: GET
        path: /auth/me
        assert:
          status: 200
`.trim(),
};

/* ══════════════════════════════════════════════════════════════════════════
   공통 UI 헬퍼
══════════════════════════════════════════════════════════════════════════ */
function Section({ num, title, children }) {
  return (
    <section className="td-section">
      <div className="td-section-badge">{num} — {title}</div>
      {children}
    </section>
  );
}

function StepVisual({ steps }) {
  return (
    <div className="td-steps-visual" style={{ flexWrap: "wrap", gap: 10 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className={`td-step-card ${s.variant ?? ""}`} style={{ minWidth: 160 }}>
            <div className="td-step-header">
              <span className={`td-step-badge ${s.variant ?? ""}`}>{s.label}</span>
              <span className="td-step-name">{s.name}</span>
            </div>
            <div className="td-step-fields">
              {s.fields.map(([k, v]) => (
                <div key={k} className="td-step-field">
                  <span className="td-field-key">{k}</span>
                  <span className="td-field-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="td-steps-arrow">→<span>순서 실행</span></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function InfoBox({ rows }) {
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

function ResultBox({ bad, good }) {
  return (
    <div className="td-result-compare">
      <div className="td-result-col">
        <div className="td-result-label bad">{bad.label}</div>
        {bad.metrics.map(([k, v]) => (
          <div key={k} className="td-result-metric">
            <span className="td-metric-key">{k}</span>
            <span className="td-metric-val bad">{v}</span>
          </div>
        ))}
      </div>
      <div className="td-result-vs">vs</div>
      <div className="td-result-col">
        <div className="td-result-label good">{good.label}</div>
        {good.metrics.map(([k, v]) => (
          <div key={k} className="td-result-metric">
            <span className="td-metric-key">{k}</span>
            <span className="td-metric-val good">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   튜토리얼 콘텐츠
══════════════════════════════════════════════════════════════════════════ */

/* ── N+1 vs Fetch Join ──────────────────────────────────────────────────── */
function NPlusOneContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">N+1 쿼리 문제</h2>
        <p className="td-text">
          게시글 100개를 조회할 때 JPA <strong>Lazy 로딩</strong>은 게시글마다 댓글을 별도로 조회합니다.
          결과적으로 <em>1 + 100 = 101번</em> 쿼리가 실행됩니다.
        </p>
        <div className="td-compare">
          <div className="td-compare-col bad">
            <div className="td-compare-label bad">😵 Lazy 로딩 (N+1 쿼리)</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- 게시글 목록 (1번)</span></div>
              <div className="td-code-line">SELECT * FROM posts;</div>
              <div className="td-code-line mt-8"><span className="td-code-comment">-- 게시글마다 댓글 (100번)</span></div>
              <div className="td-code-line">SELECT * FROM comments WHERE post_id = 1;</div>
              <div className="td-code-line td-code-muted">... 99번 더 ...</div>
              <div className="td-code-total bad">총 101번 쿼리</div>
            </div>
          </div>
          <div className="td-compare-arrow">→</div>
          <div className="td-compare-col good">
            <div className="td-compare-label good">✅ Fetch Join (1 쿼리)</div>
            <div className="td-code">
              <div className="td-code-line">SELECT p.*, c.*</div>
              <div className="td-code-line">FROM posts p</div>
              <div className="td-code-line">LEFT JOIN FETCH comments c</div>
              <div className="td-code-line">&nbsp;&nbsp;ON c.post_id = p.id;</div>
              <div className="td-code-total good">총 1번 쿼리</div>
            </div>
          </div>
        </div>
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">동일 조건으로 두 엔드포인트를 순서대로 테스트</h2>
        <p className="td-text">vus=5, duration=15s 동일 조건으로 두 Step을 연속 실행합니다.</p>
        <StepVisual steps={[
          { label: "Step 1", name: "Lazy 로딩", variant: "bad", fields: [["path", "/post/list-lazy"], ["vus", "5"], ["duration", "15s"]] },
          { label: "Step 2", name: "Fetch Join", variant: "good", fields: [["path", "/post/list-fetch"], ["vus", "5"], ["duration", "15s"]] },
        ]} />
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">k6 Summary의 http_req_duration 비교</h2>
        <ResultBox
          bad={{ label: "Step 1 · Lazy 로딩", metrics: [["avg", "~180ms"], ["p(95)", "~320ms"]] }}
          good={{ label: "Step 2 · Fetch Join", metrics: [["avg", "~15ms"], ["p(95)", "~25ms"]] }}
        />
        <p className="td-text" style={{ marginTop: 10, fontSize: 13 }}>
          ※ 두 Step의 상대적 차이에 주목하세요. 절대값은 환경에 따라 다릅니다.
        </p>
      </Section>
    </div>
  );
}

/* ── 재고 동시 차감 ──────────────────────────────────────────────────────── */
function StockConcurrencyContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">Race Condition — 재고가 음수가 됩니다</h2>
        <p className="td-text">
          재고를 차감할 때 <strong>락 없이</strong> read → check → write 를 수행하면,
          여러 트랜잭션이 동시에 같은 재고를 읽고 "충분하다"고 판단해 중복 차감합니다.
          재고 10개에 30건을 동시에 보내면 <em>stock이 음수</em>가 되거나 성공 건수가 10을 초과합니다.
        </p>
        <InfoBox rows={[
          ["초기 재고", "10개"],
          ["동시 요청", "30건 (Burst)"],
          ["기대 성공", "10건"],
          ["실제 결과", "stock < 0 또는 successCount > 10 (race condition)"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">초기화 → Burst 30 → 결과 검증</h2>
        <p className="td-text">
          먼저 재고를 10으로 초기화한 후 30개 요청을 동시에 발사합니다.
          final_check에서 <code>stock=0, successCount=10</code>이면 정상, 아니면 race condition 발생입니다.
        </p>
        <StepVisual steps={[
          { label: "reset", name: "재고 초기화", fields: [["method", "POST"], ["path", "/product/1/reset"], ["mode", "total_requests=1"]] },
          { label: "burst", name: "동시 구매 30건", variant: "bad", fields: [["path", "/product/1/purchase-unsafe"], ["vus", "30"], ["total", "30건"]] },
          { label: "check", name: "결과 검증", fields: [["stock", "=0?"], ["successCount", "=10?"]] },
        ]} />
        <div className="td-infobox" style={{ marginTop: 12 }}>
          <div className="td-infobox-row">
            <span className="td-infobox-key">해결 버전</span>
            <span className="td-infobox-val"><code>/product/1/purchase-lock</code> — SELECT FOR UPDATE로 직렬화</span>
          </div>
        </div>
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">final_check 통과 여부로 정합성 확인</h2>
        <ResultBox
          bad={{ label: "unsafe (락 없음)", metrics: [["stock", "< 0 가능"], ["successCount", "> 10 가능"], ["check", "FAIL"]] }}
          good={{ label: "lock (비관적 락)", metrics: [["stock", "= 0"], ["successCount", "= 10"], ["check", "PASS"]] }}
        />
      </Section>
    </div>
  );
}

/* ── 잔액 Lost Update ───────────────────────────────────────────────────── */
function WalletLostUpdateContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">Lost Update — 충전금이 사라집니다</h2>
        <p className="td-text">
          잔액 충전 시 <strong>락 없이</strong> read-modify-write 하면 여러 트랜잭션이
          동시에 같은 잔액을 읽고 덮어씁니다. 일부 충전이 유실(Lost Update)되어
          <em>최종 잔액이 기대보다 낮아집니다.</em>
        </p>
        <InfoBox rows={[
          ["초기 잔액", "10,000원"],
          ["충전 단위", "1,000원 × 30회"],
          ["기대 잔액", "40,000원"],
          ["실제 결과", "40,000원 미만 (일부 충전 유실)"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">초기화 → Burst 30 → 잔액 검증</h2>
        <StepVisual steps={[
          { label: "reset", name: "지갑 초기화", fields: [["path", "/wallet/1/reset"], ["mode", "total_requests=1"]] },
          { label: "burst", name: "동시 충전 30건", variant: "bad", fields: [["path", "/wallet/1/deposit-unsafe"], ["amount", "1000"], ["vus", "30"]] },
          { label: "check", name: "잔액 검증", fields: [["balance", "=40000?"]] },
        ]} />
        <div className="td-infobox" style={{ marginTop: 12 }}>
          <div className="td-infobox-row">
            <span className="td-infobox-key">해결 버전</span>
            <span className="td-infobox-val"><code>/wallet/1/deposit-pessimistic</code> — SELECT FOR UPDATE</span>
          </div>
        </div>
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">final_check의 balance 값으로 유실 확인</h2>
        <ResultBox
          bad={{ label: "unsafe (락 없음)", metrics: [["balance", "< 40000"], ["check", "FAIL"]] }}
          good={{ label: "pessimistic (비관적 락)", metrics: [["balance", "= 40000"], ["check", "PASS"]] }}
        />
      </Section>
    </div>
  );
}

/* ── 다중 사용자 지갑 ───────────────────────────────────────────────────── */
function WalletMultiuserContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">users.csv로 VU마다 다른 사용자 할당</h2>
        <p className="td-text">
          단일 사용자 테스트는 같은 레코드에 집중해 경합을 만들지만,
          실제 서비스는 사용자마다 독립적인 자원을 다룹니다.
          <strong>users.csv</strong>로 VU별 userId를 다르게 할당해
          user1~5가 각자의 지갑을 충전하는 시나리오를 테스트합니다.
        </p>
        <InfoBox rows={[
          ["users.csv", "userId,loginId (user1~5)"],
          ["충전 단위", "1,000원 × 1회 (사용자별)"],
          ["기대 결과", "각 user 잔액 11,000원"],
          ["auth", "none (로그인 없이 userId만 path에 사용)"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">전체 초기화 → users.csv 기반 충전 → 사용자별 검증</h2>
        <StepVisual steps={[
          { label: "reset", name: "5명 지갑 초기화", fields: [["path", "/wallet/{1~5}/reset"], ["mode", "total_requests=5"]] },
          { label: "deposit", name: "사용자별 충전", variant: "good", fields: [["template", "cookie_auth"], ["users", "users.csv"], ["path", "/wallet/{{userId}}/deposit-pessimistic"]] },
          { label: "check", name: "5명 잔액 검증", fields: [["balance", "= 11000"]] },
        ]} />
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">final_check에서 user1~5 각각 11,000원 확인</h2>
        <ResultBox
          bad={{ label: "단일 사용자 반복", metrics: [["문제", "한 지갑에 집중"], ["검증", "경합만 테스트"]] }}
          good={{ label: "users.csv 분리", metrics: [["각 user 잔액", "11,000원"], ["check", "PASS × 5"]] }}
        />
      </Section>
    </div>
  );
}

/* ── 멱등성 결제 ────────────────────────────────────────────────────────── */
function PaymentIdempotencyContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">중복 결제 — 같은 요청이 10번 처리됩니다</h2>
        <p className="td-text">
          네트워크 재시도나 버튼 중복 클릭으로 동일 결제 요청이 여러 번 도착할 수 있습니다.
          <strong>멱등성 없는 API</strong>는 요청마다 새 결제 레코드를 생성해
          <em>DB에 중복 결제가 쌓입니다.</em>
          idempotencyKey를 DB unique 제약으로 보호하면 첫 번째 요청만 저장됩니다.
        </p>
        <InfoBox rows={[
          ["동시 요청", "10건 (동일 idempotencyKey)"],
          ["unsafe 결과", "결제 레코드 10건 생성 (중복)"],
          ["idempotent 결과", "결제 레코드 1건, confirmCount=1"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">동일 key로 10건을 동시에 발사</h2>
        <StepVisual steps={[
          { label: "burst", name: "동시 결제 10건", variant: "bad", fields: [["path", "/payment/confirm-unsafe"], ["vus", "10"], ["total", "10건"]] },
        ]} />
        <div className="td-infobox" style={{ marginTop: 12 }}>
          <div className="td-infobox-row">
            <span className="td-infobox-key">해결 버전</span>
            <span className="td-infobox-val"><code>/payment/confirm-idempotent</code> + final_check(confirmCount=1)</span>
          </div>
        </div>
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">DB 레코드 수와 confirmCount로 멱등성 확인</h2>
        <ResultBox
          bad={{ label: "unsafe (멱등성 없음)", metrics: [["결제 레코드", "10건 생성"], ["check", "불가"]] }}
          good={{ label: "idempotent (멱등성 보장)", metrics: [["결제 레코드", "1건"], ["confirmCount", "= 1"], ["check", "PASS"]] }}
        />
      </Section>
    </div>
  );
}

/* ── params 기반 결제 ───────────────────────────────────────────────────── */
function PaymentParamsContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">params.json으로 VU마다 다른 idempotencyKey 할당</h2>
        <p className="td-text">
          users.csv가 사용자 분리라면, <strong>params.json</strong>은 요청 데이터 분리입니다.
          VU마다 다른 idempotencyKey를 할당해 각자 독립적인 결제를 실행합니다.
          각 Key당 정확히 1건만 저장되는지 final_check로 검증합니다.
        </p>
        <InfoBox rows={[
          ["params.json", "idempotencyKey 5종 (pay-user1~5-001)"],
          ["total_requests", "5 (VU당 1회)"],
          ["기대 결과", "각 key confirmCount=1"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">params.json → 사용자별 결제 → key별 검증</h2>
        <StepVisual steps={[
          { label: "pay", name: "사용자별 결제", variant: "good", fields: [["params", "params.json"], ["key", "{{idempotencyKey}}"], ["total", "5건"]] },
          { label: "check", name: "key별 검증 ×5", fields: [["confirmCount", "= 1"]] },
        ]} />
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">final_check에서 5개 key 모두 confirmCount=1 확인</h2>
        <ResultBox
          bad={{ label: "동일 key 반복", metrics: [["문제", "중복 결제 가능성"], ["검증", "단일 레코드만"]] }}
          good={{ label: "params.json 분리", metrics: [["각 key confirmCount", "= 1"], ["check", "PASS × 5"]] }}
        />
      </Section>
    </div>
  );
}

/* ── 트랜잭션 없음 ──────────────────────────────────────────────────────── */
function OrderNoTxContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">부분 저장 — Order만 남고 OrderItem이 없습니다</h2>
        <p className="td-text">
          <code>@Transactional</code> 없이 주문을 생성하면 Order를 저장한 뒤 예외가 발생해도
          이미 커밋된 Order는 DB에 남습니다. OrderItem은 저장되지 않아
          <em>고아 주문(orphaned order)</em>이 생깁니다.
        </p>
        <InfoBox rows={[
          ["동작", "Order 저장 → 예외 발생 → OrderItem 저장 안 됨"],
          ["결과", "Order 레코드만 존재, OrderItem 없음"],
          ["검증", "/order/stats → orphanedOrders = 10"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">초기화 → 주문 10건 → 고아 주문 검증</h2>
        <StepVisual steps={[
          { label: "reset", name: "주문 초기화", fields: [["path", "/order/reset"], ["method", "DELETE"]] },
          { label: "create", name: "주문 10건 생성", variant: "bad", fields: [["path", "/order/create-no-tx"], ["total", "10건"], ["vus", "1"]] },
          { label: "check", name: "고아 주문 검증", fields: [["orphanedOrders", "=10?"], ["totalOrders", "=10?"]] },
        ]} />
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">orphanedOrders로 부분 저장 증거 확인</h2>
        <ResultBox
          bad={{ label: "no-tx (트랜잭션 없음)", metrics: [["totalOrders", "10"], ["orphanedOrders", "10"], ["check", "FAIL"]] }}
          good={{ label: "with-tx (트랜잭션 보장)", metrics: [["totalOrders", "0"], ["orphanedOrders", "0"], ["check", "PASS"]] }}
        />
      </Section>
    </div>
  );
}

/* ── 트랜잭션 보장 ──────────────────────────────────────────────────────── */
function OrderWithTxContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="무슨 문제인가?">
        <h2 className="td-section-title">원자성 — 예외 발생 시 Order도 함께 롤백됩니다</h2>
        <p className="td-text">
          <code>@Transactional</code>로 감싸면 예외 발생 시 Order와 OrderItem이
          <strong>모두 롤백</strong>됩니다. 고아 주문이 남지 않고 DB는 완전히 초기 상태로 돌아갑니다.
        </p>
        <InfoBox rows={[
          ["동작", "Order 저장 → 예외 → 전체 롤백"],
          ["결과", "DB에 아무 데이터도 남지 않음"],
          ["검증", "/order/stats → totalOrders = 0"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">초기화 → 주문 10건 → 완전 롤백 검증</h2>
        <StepVisual steps={[
          { label: "reset", name: "주문 초기화", fields: [["path", "/order/reset"], ["method", "DELETE"]] },
          { label: "create", name: "주문 10건 생성", variant: "good", fields: [["path", "/order/create-with-tx"], ["total", "10건"], ["vus", "1"]] },
          { label: "check", name: "롤백 검증", fields: [["totalOrders", "=0?"], ["orphanedOrders", "=0?"]] },
        ]} />
      </Section>

      <Section num="03" title="결과 해석">
        <h2 className="td-section-title">totalOrders=0으로 완전 롤백 증명</h2>
        <ResultBox
          bad={{ label: "no-tx (부분 저장)", metrics: [["totalOrders", "10"], ["orphanedOrders", "10"]] }}
          good={{ label: "with-tx (완전 롤백)", metrics: [["totalOrders", "0"], ["orphanedOrders", "0"], ["check", "PASS"]] }}
        />
      </Section>
    </div>
  );
}

/* ── 낙관적 락 vs 비관적 락 ─────────────────────────────────────────────── */
function WalletOptimisticContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="낙관적 락이란?">
        <h2 className="td-section-title">충돌을 "사후에" 감지합니다</h2>
        <p className="td-text">
          낙관적 락은 DB 레코드에 <strong>@Version</strong> 필드를 두고,
          업데이트 시 버전이 읽을 때와 같은지 확인합니다.
          다른 트랜잭션이 먼저 수정했다면 <em>409 Conflict</em>를 반환하고 클라이언트가 재시도해야 합니다.
        </p>
        <div className="td-compare">
          <div className="td-compare-col bad">
            <div className="td-compare-label bad">😵 고충돌 상황 (Burst 30)</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- T1, T2 동시에 읽음</span></div>
              <div className="td-code-line">SELECT * FROM wallet WHERE id=1;</div>
              <div className="td-code-line"><span className="td-code-comment">-- version=5, balance=10000</span></div>
              <div className="td-code-line mt-8">UPDATE wallet SET balance=11000, version=6</div>
              <div className="td-code-line">&nbsp;&nbsp;WHERE id=1 AND version=5;</div>
              <div className="td-code-line"><span className="td-code-comment">-- T1 성공 → version=6</span></div>
              <div className="td-code-line"><span className="td-code-comment">-- T2: version 불일치 → 409!</span></div>
              <div className="td-code-total bad">충돌 시 409 — 재시도 없으면 유실</div>
            </div>
          </div>
          <div className="td-compare-arrow">→</div>
          <div className="td-compare-col good">
            <div className="td-compare-label good">✅ 저충돌 상황 (순차)</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- VU가 순서대로 실행</span></div>
              <div className="td-code-line">T1: version=5 읽기 → 성공</div>
              <div className="td-code-line">T2: version=6 읽기 → 성공</div>
              <div className="td-code-line">T3: version=7 읽기 → 성공</div>
              <div className="td-code-line td-code-muted">... 충돌 없음</div>
              <div className="td-code-total good">충돌율 낮으면 PASS</div>
            </div>
          </div>
        </div>
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">Burst 30 — 낙관적 락의 한계 확인</h2>
        <p className="td-text">
          30건을 동시에 발사하면 많은 요청이 version 충돌로 <strong>409</strong>를 받습니다.
          재시도 로직이 없으면 일부 충전이 유실되어 잔액이 40,000원에 미달합니다.
        </p>
        <StepVisual steps={[
          { label: "reset", name: "지갑 초기화", fields: [["path", "/wallet/1/reset"], ["mode", "total_requests=1"]] },
          { label: "burst", name: "동시 충전 30건", variant: "bad", fields: [["path", "/wallet/1/deposit-optimistic"], ["vus", "30"], ["amount", "1000"]] },
          { label: "check", name: "잔액 검증", fields: [["balance", "=40000?"], ["결과", "FAIL 가능"]] },
        ]} />
        <InfoGrid rows={[
          ["해결 버전 (비교)", "deposit-pessimistic — SELECT FOR UPDATE, Burst 30도 PASS"],
        ]} />
      </Section>

      <Section num="03" title="낙관적 vs 비관적 — 선택 기준">
        <h2 className="td-section-title">충돌율에 따라 적합한 락이 다릅니다</h2>
        <ResultBox
          bad={{ label: "낙관적 락 — 고충돌 시", metrics: [["balance", "< 40000 가능"], ["409 발생", "충돌마다"], ["재시도", "클라이언트 구현 필요"], ["check", "FAIL 가능"]] }}
          good={{ label: "비관적 락 — 항상 안전", metrics: [["balance", "= 40000"], ["409 없음", "직렬화 대기"], ["처리량", "락 대기로 낮아짐"], ["check", "PASS"]] }}
        />
        <InfoBox rows={[
          ["낙관적 락 적합", "읽기가 많고 쓰기 충돌이 드문 경우 (e.g. 사용자 프로필 수정)"],
          ["비관적 락 적합", "잔액·재고처럼 동시 쓰기 충돌이 잦은 경우"],
          ["원자적 UPDATE", "단순 누적 연산이면 둘 다 필요 없음 (다음 튜토리얼 참고)"],
        ]} />
      </Section>
    </div>
  );
}

/* ── 원자적 UPDATE ───────────────────────────────────────────────────────── */
function WalletAtomicContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="원자적 UPDATE란?">
        <h2 className="td-section-title">읽기 단계 자체를 없앱니다</h2>
        <p className="td-text">
          Lost Update는 <em>읽기 → 계산 → 쓰기</em> 사이의 간격에서 발생합니다.
          <strong>원자적 UPDATE</strong>는 이 간격 자체를 없앱니다.
          DB가 읽기와 쓰기를 <em>한 SQL 문</em>으로 처리하므로 락 없이도 정합성이 보장됩니다.
        </p>
        <div className="td-compare">
          <div className="td-compare-col bad">
            <div className="td-compare-label bad">😵 Read-Modify-Write (Lost Update)</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- ① 읽기</span></div>
              <div className="td-code-line">SELECT balance FROM wallet WHERE id=1;</div>
              <div className="td-code-line"><span className="td-code-comment">-- ② 계산 (여기서 다른 TX 끼어들 수 있음)</span></div>
              <div className="td-code-line">newBalance = balance + 1000;</div>
              <div className="td-code-line"><span className="td-code-comment">-- ③ 쓰기</span></div>
              <div className="td-code-line">UPDATE wallet SET balance = {"{newBalance}"}</div>
              <div className="td-code-line">&nbsp;&nbsp;WHERE id=1;</div>
              <div className="td-code-total bad">읽기와 쓰기 사이 → Lost Update</div>
            </div>
          </div>
          <div className="td-compare-arrow">→</div>
          <div className="td-compare-col good">
            <div className="td-compare-label good">✅ 원자적 UPDATE (한 문장)</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- 읽기+계산+쓰기를 DB가 원자적으로</span></div>
              <div className="td-code-line">UPDATE wallet</div>
              <div className="td-code-line">&nbsp;&nbsp;SET balance = balance + 1000</div>
              <div className="td-code-line">&nbsp;&nbsp;WHERE id = 1;</div>
              <div className="td-code-line td-code-muted">&nbsp;</div>
              <div className="td-code-line td-code-muted">&nbsp;</div>
              <div className="td-code-total good">간격 없음 → Lost Update 불가</div>
            </div>
          </div>
        </div>
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">Burst 30 — 락 없이도 PASS</h2>
        <p className="td-text">
          비관적 락과 동일한 Burst 30 조건에서 원자적 UPDATE는 락 없이도 잔액 정합성을 보장합니다.
          처리량도 높아집니다.
        </p>
        <StepVisual steps={[
          { label: "reset", name: "지갑 초기화", fields: [["path", "/wallet/1/reset"], ["mode", "total_requests=1"]] },
          { label: "burst", name: "동시 충전 30건", variant: "good", fields: [["path", "/wallet/1/deposit-atomic"], ["vus", "30"], ["amount", "1000"]] },
          { label: "check", name: "잔액 검증", fields: [["balance", "=40000"], ["check", "PASS"]] },
        ]} />
      </Section>

      <Section num="03" title="세 가지 방법 비교">
        <h2 className="td-section-title">Lost Update 해결 방법 총정리</h2>
        <InfoBox rows={[
          ["unsafe",         "읽기→계산→쓰기 / 락 없음 → Lost Update 발생 / 빠르지만 위험"],
          ["비관적 락",       "SELECT FOR UPDATE → 직렬화 대기 → 안전하지만 처리량 낮음"],
          ["낙관적 락",       "@Version → 충돌 시 409 → 재시도 필요 / 저충돌 환경에 적합"],
          ["원자적 UPDATE",   "UPDATE SET col = col + n → 읽기 단계 없음 → 가장 빠르고 안전"],
          ["언제 원자적?",    "단순 누적·감소 연산. 복잡한 조건 분기가 필요하면 락 사용"],
        ]} />
      </Section>
    </div>
  );
}

/* ── auth 로그인 흐름 ────────────────────────────────────────────────────── */
function AuthLoginFlowContent() {
  return (
    <div className="td-sections">
      <Section num="01" title="auth step이란?">
        <h2 className="td-section-title">k6 실행 전에 VU별로 로그인합니다</h2>
        <p className="td-text">
          실제 서비스는 대부분 인증이 필요합니다. <strong>auth step</strong>은 k6 부하 테스트 전에
          각 VU(가상 사용자)를 <em>미리 로그인</em>시켜 쿠키나 토큰을 발급받습니다.
          이후 k6 step은 발급된 인증 정보를 자동으로 사용합니다.
        </p>
        <InfoBox rows={[
          ["실행 순서",    "auth step → (로그인 완료 후) → k6 step"],
          ["인증 방식",    "POST /auth/login → 응답 쿠키 자동 저장"],
          ["VU 분리",      "users.csv의 각 행이 VU 1개에 매핑됩니다"],
          ["depends_on",   "k6 step에 depends_on: [pre-login] 설정 필수"],
        ]} />
      </Section>

      <Section num="02" title="시나리오 구조">
        <h2 className="td-section-title">로그인 → 인증 부하 → 검증</h2>
        <StepVisual steps={[
          { label: "auth",  name: "VU별 사전 로그인", fields: [["type", "auth"], ["path", "/auth/login"], ["users", "users.csv"]] },
          { label: "k6",    name: "인증 부하 테스트", fields: [["path", "/auth/me"], ["vus", "5"], ["duration", "15s"]] },
          { label: "check", name: "인증 상태 검증",   fields: [["path", "/auth/me"], ["status", "200"]] },
        ]} />
        <div className="td-compare">
          <div className="td-compare-col bad">
            <div className="td-compare-label bad">❌ auth step 없이 인증 API 호출</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- 로그인 없이 /auth/me 요청</span></div>
              <div className="td-code-line">GET /auth/me</div>
              <div className="td-code-line"><span className="td-code-comment">-- 쿠키 없음</span></div>
              <div className="td-code-total bad">401 Unauthorized</div>
            </div>
          </div>
          <div className="td-compare-arrow">→</div>
          <div className="td-compare-col good">
            <div className="td-compare-label good">✅ auth step 후 k6 실행</div>
            <div className="td-code">
              <div className="td-code-line"><span className="td-code-comment">-- auth step이 먼저 실행</span></div>
              <div className="td-code-line">POST /auth/login → 쿠키 저장</div>
              <div className="td-code-line"><span className="td-code-comment">-- k6 step에서 자동 포함</span></div>
              <div className="td-code-total good">200 OK + 사용자 정보</div>
            </div>
          </div>
        </div>
      </Section>

      <Section num="03" title="users.csv 구성">
        <h2 className="td-section-title">VU별 로그인 정보를 분리합니다</h2>
        <p className="td-text">
          auth step은 <strong>users.csv</strong>에서 VU별 로그인 정보를 읽습니다.
          각 VU는 자신의 행을 사용해 독립적으로 로그인하고,
          <em>서로 다른 인증 세션</em>으로 부하 테스트를 수행합니다.
        </p>
        <div className="td-code" style={{ borderRadius: 6, padding: "12px 16px" }}>
          <div className="td-code-line"><span className="td-code-comment">-- users.csv 예시</span></div>
          <div className="td-code-line">loginId,password,userId</div>
          <div className="td-code-line">user1,pass1,1</div>
          <div className="td-code-line">user2,pass2,2</div>
          <div className="td-code-line">user3,pass3,3</div>
          <div className="td-code-line">user4,pass4,4</div>
          <div className="td-code-line">user5,pass5,5</div>
        </div>
        <InfoBox rows={[
          ["VU 1", "loginId=user1, password=pass1 → /auth/login → 쿠키 발급"],
          ["VU 2", "loginId=user2, password=pass2 → /auth/login → 쿠키 발급"],
          ["assign", "round_robin — VU 수 > CSV 행 수이면 순환 할당"],
        ]} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   튜토리얼 메타 정의
══════════════════════════════════════════════════════════════════════════ */
const TUTORIALS = {
  "n-plus-one": {
    emoji: "🔍", title: "N+1 vs Fetch Join", subtitle: "쿼리 최적화",
    difficulty: "easy", tags: ["JPA", "쿼리 최적화", "성능 비교"],
    yamlKey: "n-plus-one",
    content: <NPlusOneContent />,
  },
  "stock-concurrency": {
    emoji: "📦", title: "재고 동시 차감 — Race Condition", subtitle: "동시성 제어",
    difficulty: "medium", tags: ["동시성", "비관적 락", "Race Condition"],
    yamlKey: "stock-concurrency",
    altYamlKey: "stock-lock",
    altLabel: "✅ 락 버전 불러오기",
    content: <StockConcurrencyContent />,
  },
  "wallet-lost-update": {
    emoji: "💰", title: "잔액 충전 — Lost Update", subtitle: "동시성 제어",
    difficulty: "medium", tags: ["동시성", "Lost Update", "트랜잭션"],
    yamlKey: "wallet-lost-update",
    altYamlKey: "wallet-pessimistic",
    altLabel: "✅ 락 버전 불러오기",
    content: <WalletLostUpdateContent />,
  },
  "wallet-multiuser": {
    emoji: "👥", title: "다중 사용자 독립 지갑 충전", subtitle: "동시성 제어",
    difficulty: "medium", tags: ["users.csv", "다중 사용자", "VU 분리"],
    yamlKey: "wallet-multiuser",
    content: <WalletMultiuserContent />,
  },
  "payment-idempotency": {
    emoji: "💳", title: "결제 정합성 — 멱등성 처리", subtitle: "결제 안정성",
    difficulty: "medium", tags: ["멱등성", "결제", "Idempotency Key"],
    yamlKey: "payment-idempotency",
    altYamlKey: "payment-idempotent",
    altLabel: "✅ 멱등성 버전 불러오기",
    content: <PaymentIdempotencyContent />,
  },
  "payment-params": {
    emoji: "🔑", title: "params 기반 사용자별 결제", subtitle: "결제 안정성",
    difficulty: "hard", tags: ["params.json", "멱등성", "다중 키"],
    yamlKey: "payment-params",
    content: <PaymentParamsContent />,
  },
  "order-no-tx": {
    emoji: "💥", title: "트랜잭션 없음 — 부분 저장", subtitle: "트랜잭션",
    difficulty: "easy", tags: ["트랜잭션", "부분 저장", "데이터 정합성"],
    yamlKey: "order-no-tx",
    content: <OrderNoTxContent />,
  },
  "order-with-tx": {
    emoji: "✅", title: "트랜잭션 보장 — 완전 롤백", subtitle: "트랜잭션",
    difficulty: "easy", tags: ["트랜잭션", "롤백", "원자성"],
    yamlKey: "order-with-tx",
    content: <OrderWithTxContent />,
  },
  "wallet-optimistic": {
    emoji: "🔄", title: "낙관적 락 vs 비관적 락", subtitle: "동시성 제어",
    difficulty: "medium", tags: ["낙관적 락", "@Version", "409 충돌"],
    yamlKey: "wallet-optimistic",
    altYamlKey: "wallet-pessimistic",
    altLabel: "✅ 비관적 락 버전 불러오기",
    content: <WalletOptimisticContent />,
  },
  "wallet-atomic": {
    emoji: "⚡", title: "원자적 UPDATE — 락 없는 정합성", subtitle: "동시성 제어",
    difficulty: "easy", tags: ["원자적 UPDATE", "Lost Update", "성능"],
    yamlKey: "wallet-atomic",
    altYamlKey: "wallet-lost-update",
    altLabel: "😵 unsafe 버전 불러오기",
    content: <WalletAtomicContent />,
  },
  "auth-login-flow": {
    emoji: "🔐", title: "로그인 기반 부하 테스트", subtitle: "인증 흐름",
    difficulty: "medium", tags: ["auth step", "cookie", "users.csv"],
    yamlKey: "auth-login-flow",
    content: <AuthLoginFlowContent />,
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   라우터 진입점
══════════════════════════════════════════════════════════════════════════ */
export default function TutorialDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setMeta, setSteps } = useScenario();
  const [loading, setLoading] = useState(false);
  const [altLoading, setAltLoading] = useState(false);
  const [error, setError] = useState("");

  const tutorial = TUTORIALS[id];
  if (!tutorial) {
    return (
      <div className="tutorial-detail-empty">
        <p>튜토리얼을 찾을 수 없습니다.</p>
        <button className="btn-ghost" onClick={() => navigate("/tutorial")}>← 목록으로</button>
      </div>
    );
  }

  const loadYaml = async (yamlKey, setL) => {
    const yaml = SCENARIO_YAML[yamlKey];
    if (!yaml) return;
    setL(true);
    setError("");
    try {
      const res = await importScenario(yaml);
      setMeta(res.meta || { name: "", description: "" });
      setSteps(res.steps || []);
      localStorage.removeItem("lc_pending_yaml");
      navigate("/");
    } catch (e) {
      setError("불러오기 실패: " + e.message);
    } finally {
      setL(false);
    }
  };

  const handleMouseDown = (yamlKey) => {
    const yaml = SCENARIO_YAML[yamlKey];
    if (yaml) localStorage.setItem("lc_pending_yaml", yaml);
  };

  const handleClick = (e, yamlKey, setL) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    loadYaml(yamlKey, setL);
  };

  const DIFF = {
    easy:   { label: "입문", color: "#3fb950" },
    medium: { label: "중급", color: "#e3b341" },
    hard:   { label: "고급", color: "#f85149" },
  };
  const diff = DIFF[tutorial.difficulty];

  return (
    <div className="tutorial-detail-page">
      {/* ── 헤더 ── */}
      <div className="td-header">
        <Link to="/tutorial" className="td-back">← 튜토리얼 목록</Link>
        <div className="td-title-row">
          <span className="td-emoji">{tutorial.emoji}</span>
          <div>
            <div className="td-title">{tutorial.title}</div>
            <div className="td-meta">
              <span className="td-subtitle">{tutorial.subtitle}</span>
              <span className="tutorial-card-difficulty" style={{ color: diff.color, borderColor: diff.color }}>
                {diff.label}
              </span>
              {tutorial.tags.map(t => <span key={t} className="tutorial-tag">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="td-body">{tutorial.content}</div>

      {/* ── CTA ── */}
      <div className="td-cta">
        {error && <div className="error-msg">{error}</div>}
        <div className="td-cta-buttons">
          <a
            href="/"
            className={`btn-primary td-cta-main td-cta-link${loading ? " td-cta-loading" : ""}`}
            onMouseDown={() => handleMouseDown(tutorial.yamlKey)}
            onClick={(e) => handleClick(e, tutorial.yamlKey, setLoading)}
          >
            {loading ? "불러오는 중..." : "📋 시나리오 바로 불러오기"}
          </a>
          {tutorial.altYamlKey && (
            <a
              href="/"
              className={`btn-secondary td-cta-sub td-cta-link${altLoading ? " td-cta-loading" : ""}`}
              onMouseDown={() => handleMouseDown(tutorial.altYamlKey)}
              onClick={(e) => handleClick(e, tutorial.altYamlKey, setAltLoading)}
            >
              {altLoading ? "불러오는 중..." : tutorial.altLabel}
            </a>
          )}
          <Link
            to="/"
            className="btn-ghost td-cta-sub td-cta-link"
            onClick={() => {
              localStorage.removeItem("lc_pending_yaml");
              localStorage.removeItem("lc_scenario");
              setMeta({ name: "", description: "" });
              setSteps([newStep(0)]);
            }}
          >
            ✍️ 직접 따라 작성하기
          </Link>
        </div>
        <p className="td-cta-hint">
          <strong>바로 불러오기</strong>는 완성된 시나리오를 Form에 채워줍니다.
          {tutorial.altYamlKey && <> · <strong>{tutorial.altLabel?.replace("불러오기", "버전")}</strong>으로 해결 방법도 확인해보세요.</>}
        </p>
      </div>
    </div>
  );
}
