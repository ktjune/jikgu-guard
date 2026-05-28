/**
 * IngredientCard 단위 테스트
 *
 * @testing-library/react 및 jsdom이 설치되어 있지 않으므로
 * react-dom/server 의 renderToStaticMarkup 을 사용해 HTML 문자열로 렌더링 후
 * 문자열 검사 방식으로 컴포넌트 출력을 검증합니다.
 * react-dom은 react-dom 패키지로 이미 설치되어 있습니다.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IngredientCard } from "../ingredient-card";

// ─── 공통 픽스처 ────────────────────────────────────────────────────────────

const baseProps = {
  id: "test-001",
  rawIrdntNm: "에페드린",
  rawIrdntEngNm: "Ephedrine",
  rawIrdntEtcNm: null,
  appnRelsDvs: true,
  appnDt: "2023-06-15T00:00:00.000Z",
  relsDt: null,
  appnRsn: "식욕억제·흥분 효과로 남용 위험",
  relsRsn: null,
  syncedAt: "2024-01-10T09:30:00.000Z",
} as const;

// ─── appnRelsDvs=true (차단) ─────────────────────────────────────────────────

describe("IngredientCard — 차단 상태 (appnRelsDvs=true)", () => {
  let html: string;

  // 매 테스트 전에 렌더링 (vitest는 beforeAll 없이 describe 블록 수준에서 한 번만 렌더링)
  function getHtml() {
    if (!html) {
      html = renderToStaticMarkup(React.createElement(IngredientCard, baseProps));
    }
    return html;
  }

  it("컴포넌트가 에러 없이 렌더링된다", () => {
    expect(() => getHtml()).not.toThrow();
  });

  it("'차단' 뱃지 텍스트가 포함된다", () => {
    expect(getHtml()).toContain("차단");
  });

  it("danger 색상 클래스(bg-danger-50)가 article에 적용된다", () => {
    expect(getHtml()).toContain("bg-danger-50");
  });

  it("danger 색상 클래스(border-danger-500)가 article에 적용된다", () => {
    expect(getHtml()).toContain("border-danger-500");
  });

  it("뱃지에 bg-danger-600 클래스가 적용된다", () => {
    expect(getHtml()).toContain("bg-danger-600");
  });

  it("'해제' 뱃지 또는 safe 색상 클래스가 없다", () => {
    const html = getHtml();
    expect(html).not.toContain("bg-safe-50");
    expect(html).not.toContain("bg-safe-600");
  });

  it("한글 성분명이 렌더링된다", () => {
    expect(getHtml()).toContain("에페드린");
  });

  it("영문 성분명이 렌더링된다", () => {
    expect(getHtml()).toContain("Ephedrine");
  });

  it("출처: 식약처 텍스트가 포함된다", () => {
    expect(getHtml()).toContain("출처");
    expect(getHtml()).toContain("식약처");
  });

  it("식약처 링크(mfds.go.kr)가 포함된다", () => {
    expect(getHtml()).toContain("mfds.go.kr");
  });

  it("syncedAt 날짜가 YYYY-MM-DD 형식으로 렌더링된다", () => {
    // syncedAt: "2024-01-10T09:30:00.000Z" → "2024-01-10"
    expect(getHtml()).toContain("2024-01-10");
  });

  it("appnDt(지정일자)가 YYYY-MM-DD 형식으로 렌더링된다", () => {
    // appnDt: "2023-06-15T00:00:00.000Z" → "2023-06-15"
    expect(getHtml()).toContain("2023-06-15");
  });

  it("'지정일자' 레이블이 표시된다", () => {
    expect(getHtml()).toContain("지정일자");
  });

  it("지정사유가 렌더링된다", () => {
    expect(getHtml()).toContain("식욕억제·흥분 효과로 남용 위험");
  });

  it("aria-label에 성분명이 포함된다", () => {
    expect(getHtml()).toContain("성분 카드: 에페드린");
  });

  it("차단 중인 성분 aria-label이 존재한다", () => {
    expect(getHtml()).toContain("현재 차단 중인 성분");
  });
});

// ─── appnRelsDvs=false (해제) ─────────────────────────────────────────────────

describe("IngredientCard — 해제 상태 (appnRelsDvs=false)", () => {
  const releasedProps = {
    ...baseProps,
    rawIrdntNm: "스테비아",
    rawIrdntEngNm: "Stevioside",
    rawIrdntEtcNm: "스테비오사이드",
    appnRelsDvs: false,
    appnDt: "2020-01-01T00:00:00.000Z",
    relsDt: "2022-03-20T00:00:00.000Z",
    appnRsn: "과거 차단 사유",
    relsRsn: "안전성 재평가 후 해제",
    syncedAt: "2024-01-10T09:30:00.000Z",
  } as const;

  let html: string;
  function getHtml() {
    if (!html) {
      html = renderToStaticMarkup(
        React.createElement(IngredientCard, releasedProps)
      );
    }
    return html;
  }

  it("컴포넌트가 에러 없이 렌더링된다", () => {
    expect(() => getHtml()).not.toThrow();
  });

  it("'해제' 뱃지 텍스트가 포함된다", () => {
    expect(getHtml()).toContain("해제");
  });

  it("safe 색상 클래스(bg-safe-50)가 article에 적용된다", () => {
    expect(getHtml()).toContain("bg-safe-50");
  });

  it("safe 색상 클래스(border-safe-500)가 article에 적용된다", () => {
    expect(getHtml()).toContain("border-safe-500");
  });

  it("뱃지에 bg-safe-600 클래스가 적용된다", () => {
    expect(getHtml()).toContain("bg-safe-600");
  });

  it("danger 색상 클래스가 없다", () => {
    const html = getHtml();
    expect(html).not.toContain("bg-danger-50");
    expect(html).not.toContain("bg-danger-600");
  });

  it("한글 성분명 '스테비아'가 렌더링된다 (한국어 시나리오: 안전 표시)", () => {
    expect(getHtml()).toContain("스테비아");
  });

  it("기타 명칭 '스테비오사이드'가 렌더링된다", () => {
    expect(getHtml()).toContain("스테비오사이드");
  });

  it("'해제일자' 레이블이 표시된다 (지정일자 아님)", () => {
    expect(getHtml()).toContain("해제일자");
    expect(getHtml()).not.toContain("지정일자");
  });

  it("relsDt(해제일자)가 YYYY-MM-DD 형식으로 렌더링된다", () => {
    // relsDt: "2022-03-20T00:00:00.000Z" → "2022-03-20"
    expect(getHtml()).toContain("2022-03-20");
  });

  it("해제사유가 렌더링된다", () => {
    expect(getHtml()).toContain("안전성 재평가 후 해제");
  });

  it("차단 해제된 성분 aria-label이 존재한다", () => {
    expect(getHtml()).toContain("차단 해제된 성분");
  });

  it("출처: 식약처 텍스트가 포함된다", () => {
    expect(getHtml()).toContain("출처");
    expect(getHtml()).toContain("식약처");
  });
});

// ─── 선택적 필드 null 처리 ────────────────────────────────────────────────────

describe("IngredientCard — 선택적 필드 null 처리", () => {
  const minimalProps = {
    id: "min-001",
    rawIrdntNm: "DMAA",
    rawIrdntEngNm: null,
    rawIrdntEtcNm: null,
    appnRelsDvs: true,
    appnDt: null,
    relsDt: null,
    appnRsn: null,
    relsRsn: null,
    syncedAt: "2024-05-19T00:00:00.000Z",
  } as const;

  it("모든 nullable 필드가 null이어도 에러 없이 렌더링된다 (DMAA 한국어 시나리오)", () => {
    expect(() =>
      renderToStaticMarkup(React.createElement(IngredientCard, minimalProps))
    ).not.toThrow();
  });

  it("영문명이 null이면 '영문명' 레이블이 렌더링되지 않는다", () => {
    const html = renderToStaticMarkup(
      React.createElement(IngredientCard, minimalProps)
    );
    expect(html).not.toContain("영문명");
  });

  it("기타명칭이 null이면 '기타 명칭' 레이블이 렌더링되지 않는다", () => {
    const html = renderToStaticMarkup(
      React.createElement(IngredientCard, minimalProps)
    );
    expect(html).not.toContain("기타 명칭");
  });

  it("appnDt가 null이면 날짜 섹션이 렌더링되지 않는다", () => {
    const html = renderToStaticMarkup(
      React.createElement(IngredientCard, minimalProps)
    );
    // dateValue가 빈 문자열이므로 날짜 p 요소가 조건부 렌더링 안 됨
    expect(html).not.toContain("지정일자");
  });

  it("appnRsn이 null이면 지정사유 섹션이 렌더링되지 않는다", () => {
    const html = renderToStaticMarkup(
      React.createElement(IngredientCard, minimalProps)
    );
    expect(html).not.toContain("지정사유");
  });

  it("성분명 'DMAA'는 항상 렌더링된다", () => {
    const html = renderToStaticMarkup(
      React.createElement(IngredientCard, minimalProps)
    );
    expect(html).toContain("DMAA");
  });
});

// ─── formatDate 내부 로직 검증 ─────────────────────────────────────────────

describe("formatDate 로직 (syncedAt 날짜 표시 검증)", () => {
  it("ISO 문자열에서 앞 10자(YYYY-MM-DD)만 노출한다", () => {
    const props = {
      ...baseProps,
      syncedAt: "2025-12-31T23:59:59.999Z",
    };
    const html = renderToStaticMarkup(React.createElement(IngredientCard, props));
    expect(html).toContain("2025-12-31");
    // 시간 부분이 노출되지 않아야 한다
    expect(html).not.toContain("23:59:59");
  });

  it("날짜 슬라이싱이 타임존과 무관하게 동일하다 (Z suffix 포함)", () => {
    const props = {
      ...baseProps,
      appnDt: "2024-07-04T00:00:00.000Z",
      syncedAt: "2024-07-04T00:00:00.000Z",
    };
    const html = renderToStaticMarkup(React.createElement(IngredientCard, props));
    expect(html).toContain("2024-07-04");
  });
});

// ─── 팔미토일에탄올아미드 별칭 매칭 시나리오 ──────────────────────────────────

describe("한국어 시나리오: 팔미토일에탄올아미드 (별칭 매칭)", () => {
  const peaProps = {
    id: "pea-001",
    rawIrdntNm: "팔미토일에탄올아미드",
    rawIrdntEngNm: "Palmitoylethanolamide",
    rawIrdntEtcNm: "PEA, 팔미토일 에탄올아미드",
    appnRelsDvs: true,
    appnDt: "2024-03-01T00:00:00.000Z",
    relsDt: null,
    appnRsn: "안전성 미확인 성분",
    relsRsn: null,
    syncedAt: "2024-05-01T00:00:00.000Z",
  } as const;

  it("한글 성분명이 렌더링된다", () => {
    const html = renderToStaticMarkup(React.createElement(IngredientCard, peaProps));
    expect(html).toContain("팔미토일에탄올아미드");
  });

  it("영문명(Palmitoylethanolamide)이 렌더링된다", () => {
    const html = renderToStaticMarkup(React.createElement(IngredientCard, peaProps));
    expect(html).toContain("Palmitoylethanolamide");
  });

  it("기타 명칭(PEA 별칭)이 렌더링된다", () => {
    const html = renderToStaticMarkup(React.createElement(IngredientCard, peaProps));
    expect(html).toContain("PEA");
  });

  it("차단 뱃지와 danger 테마가 적용된다", () => {
    const html = renderToStaticMarkup(React.createElement(IngredientCard, peaProps));
    expect(html).toContain("차단");
    expect(html).toContain("bg-danger-50");
  });
});
