import React, { useState } from "react";
import { Link } from "react-router-dom";

/* ── 세팅 가이드 ────────────────────────────────────────────────────────────── */
const SETUP_GUIDES = [
  {
    id: "setup-container",
    num: 1,
    emoji: "🐳",
    title: "컨테이너 제어",
    difficulty: "easy",
    description:
      "Docker Compose로 오케스트레이터 서버를 실행하고 관리하는 기본 명령어를 익힙니다. 처음 시작하기 전에 반드시 확인하세요.",
    tags: ["Docker", "Docker Compose", "컨테이너"],
    commands: [
      { label: "폴더 이동",  cmd: "cd loadtest-converter" },
      { label: "실행",      cmd: "docker-compose up -d" },
      { label: "정지",      cmd: "docker-compose stop" },
      { label: "재시작",    cmd: "docker-compose restart" },
      { label: "종료",      cmd: "docker-compose down" },
    ],
  },
  {
    id: "setup-loadtest",
    num: 2,
    emoji: "⚙️",
    title: "부하테스트 설정",
    difficulty: "easy",
    description:
      "VU 수, RPS, Duration 등 부하 파라미터를 설정하는 방법과 rps / total_requests / burst 세 가지 모드를 익힙니다.",
    tags: ["VU", "Duration", "RPS", "부하 설정"],
    commands: [
      { label: "지속 부하",  cmd: "rps=10, duration=30s" },
      { label: "정확한 건수", cmd: "total_requests=100" },
      { label: "동시 폭발",  cmd: "burst, vus=30" },
    ],
  },
  {
    id: "setup-params-users",
    num: 3,
    emoji: "👤",
    title: "파라미터와 유저 정보 설정",
    difficulty: "easy",
    description:
      "params.json으로 VU별 요청 파라미터를, users.csv로 사용자 신원을 분리해 독립적인 부하 테스트를 구성합니다.",
    tags: ["params.json", "users.csv", "VU 분리"],
    commands: [
      { label: "params",  cmd: "${params.idempotencyKey}" },
      { label: "users",   cmd: "${users.userId}" },
      { label: "전략",    cmd: "round_robin" },
    ],
  },
];

/* ── 기본 예제 ─────────────────────────────────────────────────────────────── */
const TUTORIALS = [
  {
    id: "n-plus-one",
    emoji: "🔍",
    title: "N+1 vs Fetch Join",
    subtitle: "쿼리 최적화",
    description:
      "Lazy 로딩이 만드는 N+1 쿼리 문제를 부하 테스트로 체감하고, Fetch Join 최적화 전후의 응답 속도를 비교합니다.",
    tags: ["쿼리 최적화", "JPA", "성능 비교"],
    difficulty: "easy",
    scenario: "n-plus-one.yml",
  },
  {
    id: "stock-concurrency",
    emoji: "📦",
    title: "재고 동시 차감 — Race Condition",
    subtitle: "동시성 제어",
    description:
      "재고 10개에 30개의 동시 요청을 보냈을 때 Lock 없이는 음수 재고가 발생하고, 비관적 락은 정확히 10건만 성공함을 확인합니다.",
    tags: ["동시성", "비관적 락", "Race Condition"],
    difficulty: "medium",
    scenario: "stock-unsafe.yml / stock-lock.yml",
  },
  {
    id: "auction-lost-update",
    emoji: "🔨",
    title: "경매 입찰 — Lost Update",
    subtitle: "동시성 제어",
    description:
      "30명이 동시에 입찰할 때 락 없이 read-modify-write하면 대부분의 입찰이 유실됩니다. 비관적 락으로 모든 입찰이 정확히 반영됨을 확인합니다.",
    tags: ["동시성", "Lost Update", "비관적 락"],
    difficulty: "medium",
    scenario: "auction-unsafe.yml / auction-pessimistic.yml",
  },
  {
    id: "wallet-multiuser",
    emoji: "👥",
    title: "다중 사용자 독립 지갑 충전",
    subtitle: "동시성 제어",
    description:
      "users.csv로 VU마다 다른 사용자 ID를 할당해 각자의 지갑에 독립적으로 충전합니다. 사용자별 격리와 정확성을 검증합니다.",
    tags: ["users.csv", "다중 사용자", "VU 분리"],
    difficulty: "medium",
    scenario: "wallet-multiuser.yml",
  },
  {
    id: "payment-idempotency",
    emoji: "💳",
    title: "결제 정합성 — 멱등성 처리",
    subtitle: "결제 안정성",
    description:
      "동일 결제 요청이 10번 중복으로 도착할 때 멱등성 없는 API는 중복 결제를 만들고, DB unique 제약 기반 설계는 단 1건만 저장됨을 확인합니다.",
    tags: ["멱등성", "결제", "Idempotency Key"],
    difficulty: "medium",
    scenario: "payment-unsafe.yml / payment-idempotent.yml",
  },
  {
    id: "payment-params",
    emoji: "🔑",
    title: "params 기반 사용자별 결제",
    subtitle: "결제 안정성",
    description:
      "params.json으로 VU마다 다른 idempotencyKey를 할당해 각각 독립적인 결제 요청을 실행하고 confirmCount를 검증합니다.",
    tags: ["params.json", "멱등성", "다중 키"],
    difficulty: "hard",
    scenario: "payment-params.yml",
  },
  {
    id: "order-no-tx",
    emoji: "💥",
    title: "트랜잭션 없음 — 부분 저장",
    subtitle: "트랜잭션",
    description:
      "@Transactional 없이 예외가 발생하면 Order만 남고 OrderItem은 저장되지 않습니다. 고아 주문이 DB에 남는 부분 저장 문제를 확인합니다.",
    tags: ["트랜잭션", "부분 저장", "데이터 정합성"],
    difficulty: "easy",
    scenario: "order-no-tx.yml",
  },
  {
    id: "order-with-tx",
    emoji: "✅",
    title: "트랜잭션 보장 — 완전 롤백",
    subtitle: "트랜잭션",
    description:
      "@Transactional로 감싸면 예외 발생 시 Order와 OrderItem 모두 롤백됩니다. 트랜잭션 원자성이 데이터 정합성을 어떻게 보장하는지 확인합니다.",
    tags: ["트랜잭션", "롤백", "원자성"],
    difficulty: "easy",
    scenario: "order-with-tx.yml",
  },
  {
    id: "wallet-optimistic",
    emoji: "🔄",
    title: "낙관적 락 vs 비관적 락",
    subtitle: "동시성 제어",
    description:
      "@Version 필드로 낙관적 락을 구현하면 Burst 30 환경에서 충돌이 발생해 잔액이 미달합니다. 비관적 락(SELECT FOR UPDATE)과 성능·정합성 트레이드오프를 비교합니다.",
    tags: ["낙관적 락", "@Version", "409 충돌"],
    difficulty: "medium",
    scenario: "wallet-optimistic.yml / wallet-pessimistic.yml",
  },
  {
    id: "wallet-atomic",
    emoji: "⚡",
    title: "원자적 UPDATE — 락 없는 정합성",
    subtitle: "동시성 제어",
    description:
      "읽기→계산→쓰기 대신 UPDATE SET col = col + n 한 문장으로 처리하면 락 없이도 Lost Update가 발생하지 않습니다. 세 가지 방법의 성능과 정합성을 총정리합니다.",
    tags: ["원자적 UPDATE", "Lost Update", "성능"],
    difficulty: "easy",
    scenario: "wallet-atomic.yml",
  },
  {
    id: "auth-login-flow",
    emoji: "🔐",
    title: "로그인 기반 부하 테스트",
    subtitle: "인증 흐름",
    description:
      "auth step으로 VU별 사전 로그인 후 인증이 필요한 API에 부하를 걸고 /auth/me 상태를 검증합니다. users.csv 기반 VU 분리 인증 흐름을 처음부터 끝까지 확인합니다.",
    tags: ["auth step", "cookie", "users.csv"],
    difficulty: "medium",
    scenario: "auth-login-flow.yml",
  },
];

/* ── 도메인별 가이드라인 ────────────────────────────────────────────────────── */
const DOMAIN_TUTORIALS = [
  /* 증권 IT */
  {
    id: "domain-quote-cache",
    domain: "증권 IT",
    emoji: "💹",
    title: "시세 캐시 조회 성능",
    subtitle: "성능 최적화",
    description:
      "초당 수백 요청이 몰리는 시세 API에서 DB 직접 조회 vs Redis 캐시의 p95 latency 차이를 부하 테스트로 확인합니다.",
    tags: ["Redis", "캐시", "고빈도 조회"],
    difficulty: "medium",
    scenario: "quote-cache.yml",
  },
  {
    id: "domain-order-auth-flow",
    domain: "증권 IT",
    emoji: "🔐",
    title: "로그인 기반 주문 흐름",
    subtitle: "인증 + 주문",
    description:
      "auth step으로 계좌별 로그인 후 주문을 생성하고, extract로 orderId를 추출해 체결 상태까지 확인하는 실제 서비스 흐름을 테스트합니다.",
    tags: ["auth", "extract", "주문 흐름"],
    difficulty: "medium",
    scenario: "order-auth-flow.yml",
  },
  {
    id: "domain-oversell",
    domain: "증권 IT",
    emoji: "📉",
    title: "과매도 방지 — 잔고 Race Condition",
    subtitle: "동시성 제어",
    description:
      "보유 수량보다 많은 동시 매도 주문이 들어올 때 락 없이는 과매도가 발생합니다. SELECT FOR UPDATE로 잔고 정합성을 보장합니다.",
    tags: ["과매도", "Race Condition", "비관적 락"],
    difficulty: "medium",
    scenario: "oversell-unsafe.yml / oversell-lock.yml",
  },
  {
    id: "domain-optimistic-lock",
    domain: "증권 IT",
    emoji: "🔄",
    title: "낙관적 락 vs 비관적 락",
    subtitle: "동시성 제어",
    description:
      "주문 수정 동시 처리에서 낙관적 락(version 충돌 → 재시도)과 비관적 락의 성공률과 throughput 트레이드오프를 비교합니다.",
    tags: ["낙관적 락", "버전 관리", "충돌 재시도"],
    difficulty: "medium",
    scenario: "optimistic-vs-pessimistic.yml",
  },
  {
    id: "domain-trade-pagination",
    domain: "증권 IT",
    emoji: "📋",
    title: "거래 내역 페이지네이션",
    subtitle: "성능 최적화",
    description:
      "대량 거래 내역 조회에서 OFFSET 방식은 뒤 페이지일수록 느려집니다. Keyset(커서) 기반 페이지네이션과 p95를 비교합니다.",
    tags: ["페이지네이션", "Keyset", "대용량 조회"],
    difficulty: "medium",
    scenario: "trade-pagination.yml",
  },
  {
    id: "domain-index-compare",
    domain: "증권 IT",
    emoji: "🗂️",
    title: "인덱스 성능 비교",
    subtitle: "성능 최적화",
    description:
      "종목코드 + 날짜 복합 인덱스 유무에 따른 거래 내역 조회 성능을 대량 데이터 환경에서 확인합니다.",
    tags: ["인덱스", "복합 인덱스", "DB 최적화"],
    difficulty: "medium",
    scenario: "index-comparison.yml",
  },
  {
    id: "domain-async-order",
    domain: "증권 IT",
    emoji: "⚡",
    title: "동기 vs 비동기 주문 처리",
    subtitle: "처리량 비교",
    description:
      "주문을 동기로 처리할 때와 큐 기반 비동기로 처리할 때 처리량(RPS)과 응답 시간 트레이드오프를 확인합니다.",
    tags: ["비동기", "큐", "RPS"],
    difficulty: "hard",
    scenario: "sync-vs-async-order.yml",
  },

  /* 서비스 기업 */
  {
    id: "domain-coupon-race",
    domain: "서비스 기업",
    emoji: "🎟️",
    title: "선착순 쿠폰 발급",
    subtitle: "동시성 제어",
    description:
      "쿠폰 100장 한정에 1,000명이 동시에 신청할 때 DB만으로 처리하면 초과 발급이 발생합니다. Redis Lua Script로 원자적 처리와 비교합니다.",
    tags: ["선착순", "Redis", "초과 발급 방지"],
    difficulty: "medium",
    scenario: "coupon-unsafe.yml / coupon-redis.yml",
  },
  {
    id: "domain-cache-stampede",
    domain: "서비스 기업",
    emoji: "🌪️",
    title: "캐시 스탬피드",
    subtitle: "캐시 전략",
    description:
      "캐시 만료 순간 수천 요청이 동시에 DB로 몰려 connection이 고갈됩니다. 분산 락으로 1개 요청만 DB에 접근하도록 제한해 차이를 확인합니다.",
    tags: ["Cache Stampede", "분산 락", "Redis"],
    difficulty: "hard",
    scenario: "cache-stampede.yml",
  },
  {
    id: "domain-search-performance",
    domain: "서비스 기업",
    emoji: "🔎",
    title: "검색 성능 비교",
    subtitle: "쿼리 최적화",
    description:
      "상품명 검색에서 LIKE '%keyword%'는 Full Scan, LIKE 'keyword%'는 Index Scan, Full-text Index는 형태소 기반으로 처리됩니다. p95로 비교합니다.",
    tags: ["Full-text Search", "LIKE", "인덱스"],
    difficulty: "medium",
    scenario: "search-comparison.yml",
  },
  {
    id: "domain-async-notification",
    domain: "서비스 기업",
    emoji: "🔔",
    title: "비동기 알림 처리",
    subtitle: "처리량 비교",
    description:
      "주문 완료 후 알림 발송을 동기로 처리하면 알림 지연이 응답 지연으로 이어집니다. Kafka 기반 비동기로 분리하면 처리량(RPS) 차이를 확인합니다.",
    tags: ["비동기", "Kafka", "알림"],
    difficulty: "medium",
    scenario: "sync-vs-async-notification.yml",
  },
  {
    id: "domain-traffic-burst",
    domain: "서비스 기업",
    emoji: "📈",
    title: "이벤트 트래픽 급증",
    subtitle: "부하 내성",
    description:
      "평상시 RPS 50에서 이벤트 시 RPS 500으로 10배 급증할 때 Connection Pool 고갈과 latency 급등 흐름을 재현하고 설정 튜닝 전후를 비교합니다.",
    tags: ["트래픽 급증", "Connection Pool", "튜닝"],
    difficulty: "hard",
    scenario: "traffic-burst.yml",
  },
];

/* ── 상수 ──────────────────────────────────────────────────────────────────── */
const DIFFICULTY_LABEL = {
  easy:   { label: "입문", color: "#3fb950" },
  medium: { label: "중급", color: "#e3b341" },
  hard:   { label: "고급", color: "#f85149" },
};

const SUBTITLE_COLOR = {
  "쿼리 최적화": "#58a6ff",
  "동시성 제어": "#bc8cff",
  "결제 안정성": "#3fb950",
  "트랜잭션":   "#e3b341",
  "인증 흐름":  "#f0a500",
};

const DOMAIN_COLOR = {
  "증권 IT":    "#f0a500",
  "서비스 기업": "#06b6d4",
};

/* ── 상세 페이지가 구현된 ID 목록 ─────────────────────────────────────────── */
const READY_IDS = new Set([
  "n-plus-one",
  "stock-concurrency",
  "auction-lost-update",
  "wallet-multiuser",
  "payment-idempotency",
  "payment-params",
  "order-no-tx",
  "order-with-tx",
  "wallet-optimistic",
  "wallet-atomic",
  "auth-login-flow",
]);

/* ── SetupCard ─────────────────────────────────────────────────────────────── */
function SetupCard({ guide: g }) {
  const diff = DIFFICULTY_LABEL[g.difficulty];
  const hasCommands = g.commands.length > 0;

  const inner = (
    <>
      <div className="setup-card-header">
        <div className="setup-card-header-left">
          <span className="setup-card-num">입문-{g.num}</span>
          <span className="setup-card-emoji">{g.emoji}</span>
        </div>
        <span
          className="tutorial-card-difficulty"
          style={{ color: diff.color, borderColor: diff.color }}
        >
          {diff.label}
        </span>
      </div>
      <h3 className="tutorial-card-title">{g.title}</h3>
      <p className="tutorial-card-description">{g.description}</p>
      {hasCommands ? (
        <div className="setup-commands">
          {g.commands.map((c) => (
            <div key={c.label} className="setup-cmd-row">
              <span className="setup-cmd-label">{c.label}</span>
              <code className="setup-cmd-code">{c.cmd}</code>
            </div>
          ))}
        </div>
      ) : (
        <div className="setup-coming-soon">준비 중</div>
      )}
      <div className="tutorial-card-tags">
        {g.tags.map((tag) => (
          <span key={tag} className="tutorial-tag">{tag}</span>
        ))}
      </div>
      <div className="tutorial-card-footer">
        <span />
        <span className="btn-tutorial-start">시작하기 →</span>
      </div>
    </>
  );

  return (
    <Link to={`/setup/${g.id}`} className="setup-card setup-card--ready tutorial-card--ready">
      {inner}
    </Link>
  );
}

/* ── TutorialCard ──────────────────────────────────────────────────────────── */
function TutorialCard({ tutorial: t }) {
  const diff = DIFFICULTY_LABEL[t.difficulty];
  const isReady = READY_IDS.has(t.id);

  const inner = (
    <>
      <div className="tutorial-card-top">
        <span className="tutorial-card-emoji">{t.emoji}</span>
        <span
          className="tutorial-card-difficulty"
          style={{ color: diff.color, borderColor: diff.color }}
        >
          {diff.label}
        </span>
      </div>
      <h3 className="tutorial-card-title">{t.title}</h3>
      <p className="tutorial-card-description">{t.description}</p>
      <div className="tutorial-card-tags">
        {t.tags.map((tag) => (
          <span key={tag} className="tutorial-tag">{tag}</span>
        ))}
      </div>
      <div className="tutorial-card-footer">
        <span className="tutorial-card-file">{t.scenario}</span>
        <span className={`btn-tutorial-start ${isReady ? "" : "btn-tutorial-disabled"}`}>
          {isReady ? "시작하기 →" : "준비 중"}
        </span>
      </div>
    </>
  );

  if (isReady) {
    return (
      <Link to={`/tutorial/${t.id}`} className="tutorial-card tutorial-card--ready">
        {inner}
      </Link>
    );
  }

  return <div className="tutorial-card">{inner}</div>;
}

/* ── 페이지 ────────────────────────────────────────────────────────────────── */
export default function TutorialPage() {
  const [activeTab, setActiveTab] = useState("basic");

  const basicGroups  = [...new Set(TUTORIALS.map((t) => t.subtitle))];
  const domainGroups = [...new Set(DOMAIN_TUTORIALS.map((t) => t.domain))];

  return (
    <div className="tutorial-page">
      {/* 헤더 */}
      <div className="tutorial-header">
        <h1 className="tutorial-title">🎓 시나리오 튜토리얼</h1>
        <p className="tutorial-desc">
          실제 API 서버를 대상으로 부하 테스트 시나리오를 단계별로 작성해봅니다.
          <br />
          각 튜토리얼은 <strong>나쁜 설계 → 좋은 설계</strong> 순서로 문제를 직접 체감하고 해결합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="tutorial-tab-bar">
        <button
          className={`tutorial-tab-btn ${activeTab === "setup" ? "active" : ""}`}
          onClick={() => setActiveTab("setup")}
        >
          ⚙️ 세팅 가이드
        </button>
        <button
          className={`tutorial-tab-btn ${activeTab === "basic" ? "active" : ""}`}
          onClick={() => setActiveTab("basic")}
        >
          📚 기본 예제
        </button>
        <button
          className={`tutorial-tab-btn ${activeTab === "domain" ? "active" : ""}`}
          onClick={() => setActiveTab("domain")}
        >
          🏢 도메인별 가이드라인
        </button>
      </div>

      {/* 세팅 가이드 탭 */}
      {activeTab === "setup" && (
        <section className="tutorial-group">
          <div
            className="tutorial-group-label"
            style={{ borderColor: "#4c6ef5", color: "#4c6ef5" }}
          >
            시작하기
          </div>
          <div className="tutorial-cards">
            {SETUP_GUIDES.map((g) => (
              <SetupCard key={g.id} guide={g} />
            ))}
          </div>
        </section>
      )}

      {/* 기본 예제 탭 */}
      {activeTab === "basic" && basicGroups.map((group) => (
        <section key={group} className="tutorial-group">
          <div
            className="tutorial-group-label"
            style={{
              borderColor: SUBTITLE_COLOR[group] ?? "#4c6ef5",
              color:       SUBTITLE_COLOR[group] ?? "#4c6ef5",
            }}
          >
            {group}
          </div>
          <div className="tutorial-cards">
            {TUTORIALS.filter((t) => t.subtitle === group).map((t) => (
              <TutorialCard key={t.id} tutorial={t} />
            ))}
          </div>
        </section>
      ))}

      {/* 도메인별 가이드라인 탭 */}
      {activeTab === "domain" && (
        <>
          <div className="tutorial-domain-intro">
            <p>
              직군별 면접과 포트폴리오에서 자주 등장하는 도메인 특화 시나리오입니다.
              <br />
              기본 예제를 먼저 익힌 후 도메인 맥락에서 동일한 문제를 체감해보세요.
            </p>
          </div>

          {domainGroups.map((domain) => (
            <section key={domain} className="tutorial-group">
              <div
                className="tutorial-group-label"
                style={{
                  borderColor: DOMAIN_COLOR[domain] ?? "#4c6ef5",
                  color:       DOMAIN_COLOR[domain] ?? "#4c6ef5",
                }}
              >
                {domain}
              </div>
              <div className="tutorial-cards">
                {DOMAIN_TUTORIALS.filter((t) => t.domain === domain).map((t) => (
                  <TutorialCard key={t.id} tutorial={t} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
