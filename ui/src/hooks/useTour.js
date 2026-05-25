import { useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useScenario } from "../context/ScenarioContext.jsx";

export function useTour() {
  const { steps, addStep } = useScenario();

  // ref로 최신 값을 항상 유지 (closure stale 방지)
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const addStepRef = useRef(addStep);
  addStepRef.current = addStep;

  const startTour = () => {
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
        /* ── 0. 환영 ── */
        {
          popover: {
            title: "🚀 Loadtest Converter 가이드",
            description:
              "부하 테스트 시나리오 파일(YAML)을 GUI로 만드는 도구입니다.<br>" +
              "각 요소를 직접 클릭하며 탐색할 수 있고, 이 가이드에서 핵심 기능만 빠르게 살펴볼 수 있습니다.",
          },
        },

        /* ── 1. 시나리오 메타 ── */
        {
          element: "#tour-meta-section",
          popover: {
            title: "① 시나리오 정보",
            description:
              "시나리오의 이름과 설명을 입력합니다.<br>" +
              "생성되는 YAML 파일의 <code>name</code> / <code>description</code> 필드에 반영됩니다.",
          },
        },

        /* ── 2. Steps 섹션 전체 ── */
        {
          element: "#tour-steps-section",
          popover: {
            title: "② Steps",
            description:
              "Step은 테스트의 실행 단위입니다.<br>" +
              "<b>k6</b>: 부하 생성&nbsp;&nbsp;|&nbsp;&nbsp;<b>auth</b>: 사전 로그인<br>" +
              "<b>final_check</b>: 상태 검증&nbsp;&nbsp;|&nbsp;&nbsp;<b>command</b>: 셸 명령<br><br>" +
              "하단의 <b>+ Step 추가</b> 버튼으로 새 Step을 추가합니다.",
            side: "top",
            align: "start",
            onNextClick: () => {
              if (stepsRef.current.length === 0) {
                addStepRef.current();
                setTimeout(() => driverObj.moveNext(), 350);
              } else {
                driverObj.moveNext();
              }
            },
          },
        },

        /* ── 3. Type 선택 ── */
        {
          element: "#tour-step-0-type",
          popover: {
            title: "③ Step 타입",
            description:
              "<b>k6</b>: 가상 유저(VU)를 생성해 HTTP 부하를 보냅니다.<br>" +
              "<b>auth</b>: k6 실행 전 users.csv 계정을 미리 로그인합니다.<br>" +
              "<b>final_check</b>: 부하 완료 후 Go 엔진이 직접 DB 최종 상태를 확인합니다.<br>" +
              "<b>command</b>: DB seed·cleanup 등 임의 셸 명령을 실행합니다.",
          },
        },

        /* ── 4. Base URL ── */
        {
          element: "#tour-step-0-base-url",
          popover: {
            title: "④ Base URL",
            description:
              "부하를 보낼 서버 주소를 입력합니다.<br>" +
              "예: <code>http://localhost:8080</code><br>" +
              "Actions의 경로(<code>/api/...</code>)는 이 주소 뒤에 붙습니다.",
          },
        },

        /* ── 5. 요청 방식 (load mode) ── */
        {
          element: "#tour-step-0-load-mode",
          popover: {
            title: "⑤ 요청 방식",
            description:
              "<b>RPS 기준</b>: 초당 요청 수를 고정해 일정 시간 동안 부하를 유지합니다. 일반 성능 측정에 적합합니다.<br>" +
              "<b>총 요청 수</b>: 정해진 횟수를 제한 시간 안에 실행합니다. 재고·멱등성 검증에 적합합니다.<br>" +
              "<b>Burst</b>: 모든 요청을 동시에 한꺼번에 발사합니다. 순간 경합 상황을 재현합니다.",
          },
        },

        /* ── 6. Actions ── */
        {
          element: "#tour-step-0-actions",
          popover: {
            title: "⑥ Actions",
            description:
              "k6가 실행할 HTTP 요청 목록을 정의합니다.<br>" +
              "메서드, 경로, body, headers를 설정하고<br>" +
              "<b>extract</b>로 응답값을 이후 action에서 <code>{{변수명}}</code>으로 재사용할 수 있습니다.",
          },
        },

        /* ── 7. 가져오기 ── */
        {
          element: "#tour-import-btn",
          popover: {
            title: "⑦ 기존 파일 가져오기",
            description:
              "이미 작성한 <b>scenario.yml</b> 파일을 UI로 불러와 수정할 수 있습니다.<br>" +
              "orchestrator 예제 파일을 열어 구조를 살펴보기에도 좋습니다.",
          },
        },

        /* ── 8. 미리보기 ── */
        {
          element: "#tour-preview-btn",
          popover: {
            title: "⑧ YAML 미리보기",
            description:
              "현재 설정이 어떤 YAML로 변환되는지 확인합니다.<br>" +
              "파일로 내보내기 전에 검토하거나, 복사해 직접 편집할 수 있습니다.",
          },
        },

        /* ── 9. ZIP 내보내기 ── */
        {
          element: "#tour-export-btn",
          popover: {
            title: "⑨ ZIP 내보내기",
            description:
              "<b>scenario.yml</b>, <b>users.csv</b>, <b>params.json</b>을 ZIP으로 내보냅니다.<br>" +
              "orchestrator의 <code>scenarios/</code> 폴더에 압축을 해제하면 바로 실행할 수 있습니다.",
          },
        },
      ],
    });

    driverObj.drive();
  };

  return { startTour };
}
