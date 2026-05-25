import React, { useState } from "react";

/**
 * 라벨 옆 ? 아이콘에 hover 시 설명 툴팁을 표시한다.
 *
 * 사용법:
 *   <label>Base URL <Tooltip text="부하를 보낼 서버 주소. 예: http://localhost:8080" /></label>
 */
export default function Tooltip({ text }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="tooltip-icon">?</span>
      {visible && <span className="tooltip-box">{text}</span>}
    </span>
  );
}
