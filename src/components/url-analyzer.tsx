"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IngredientCard } from "./ingredient-card";

// ─── 타입 ────────────────────────────────────────────────────────────
interface IngredientResult {
  id: string;
  rawIrdntNm: string;
  rawIrdntEngNm: string | null;
  rawIrdntEtcNm: string | null;
  appnRelsDvs: boolean;
  appnDt: string | null;
  relsDt: string | null;
  appnRsn: string | null;
  relsRsn: string | null;
  syncedAt: string;
}

type Step =
  | { type: "idle" }
  | { type: "fetching" }
  | { type: "checking" }
  | { type: "done"; productName: string; tokens: string[]; results: IngredientResult[]; total: number }
  | { type: "error"; message: string; canFallback?: boolean };

// ─── 스키마 ────────────────────────────────────────────────────────────
const schema = z.object({
  url: z.string().url("올바른 URL을 입력해주세요."),
});
type FormValues = z.infer<typeof schema>;

// ─── 지원 사이트 ─────────────────────────────────────────────────────
const SUPPORTED_SITES = [
  { name: "iHerb", color: "bg-green-100 text-green-700" },
  { name: "Amazon", color: "bg-yellow-100 text-yellow-700" },
  { name: "기타 해외몰", color: "bg-gray-100 text-gray-600" },
];

const BLOCKED_SITES = [
  { name: "네이버 스마트스토어" },
  { name: "쿠팡" },
  { name: "11번가" },
];

// ─── 클라이언트 측 성분 토큰 파싱 ────────────────────────────────────
const STOPWORDS = new Set([
  "and", "or", "with", "the", "of", "in", "for", "from", "by", "as",
  "other", "each", "per", "contains", "including", "plus", "made",
  "이상", "이하", "미만", "포함", "해당", "기타", "성분", "함량",
]);

function parseIngredientTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const line of text.split(/[\n\r]+/)) {
    for (const part of line.split(/[,;·•\/|:]+/)) {
      const cleaned = part
        .replace(/\b\d+\s*(?:mg|g|mcg|µg|%|iu|IU|ml|mL|RE|NE|mcg RAE)\b/gi, "")
        .replace(/[()[\]{}*#@!?]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const lower = cleaned.toLowerCase();
      if (
        cleaned.length >= 2 &&
        cleaned.length <= 80 &&
        !STOPWORDS.has(lower) &&
        !/^\d+$/.test(cleaned)
      ) {
        tokens.push(cleaned);
      }
    }
  }
  return [...new Set(tokens)];
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────
export default function UrlAnalyzer() {
  const [step, setStep] = useState<Step>({ type: "idle" });
  const [fallbackText, setFallbackText] = useState("");
  const [showFallback, setShowFallback] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // ─── 성분 DB 대조 ───────────────────────────────────────────────
  async function checkIngredients(tokens: string[], productName: string) {
    setStep({ type: "checking" });
    try {
      const res = await fetch("/api/ingredients/batch-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStep({
        type: "done",
        productName,
        tokens,
        results: data.results ?? [],
        total: data.total ?? 0,
      });
    } catch (err) {
      setStep({
        type: "error",
        message: err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.",
      });
    }
  }

  // ─── URL 분석 ───────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setStep({ type: "fetching" });
    setShowFallback(false);

    try {
      const res = await fetch("/api/products/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: values.url }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const tokens: string[] = data.tokens ?? [];
      if (tokens.length === 0) {
        setStep({ type: "done", productName: data.productName, tokens: [], results: [], total: 0 });
        return;
      }
      await checkIngredients(tokens, data.productName);
    } catch (err) {
      setStep({
        type: "error",
        message: err instanceof Error ? err.message : "페이지 분석에 실패했습니다.",
        canFallback: true,
      });
    }
  }

  // ─── 직접 붙여넣기 분석 ─────────────────────────────────────────
  async function onFallbackSubmit() {
    if (!fallbackText.trim()) return;
    const tokens = parseIngredientTokens(fallbackText);
    if (tokens.length === 0) {
      setStep({ type: "error", message: "성분 텍스트에서 유효한 성분명을 추출하지 못했습니다.", canFallback: true });
      return;
    }
    await checkIngredients(tokens, "직접 입력된 성분 목록");
  }

  const isProcessing = step.type === "fetching" || step.type === "checking";

  return (
    <div className="space-y-6">

      {/* 지원 사이트 */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">자동 분석 가능:</span>
          {SUPPORTED_SITES.map((s) => (
            <span key={s.name} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
              {s.name}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">접근 제한:</span>
          {BLOCKED_SITES.map((s) => (
            <span key={s.name} className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-400 line-through">
              {s.name}
            </span>
          ))}
          <span className="text-xs text-gray-400">→ 아래 직접 입력 이용</span>
        </div>
      </div>

      {/* URL 입력 폼 */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1.5">
          구매 링크 붙여넣기
        </label>
        <div className="flex gap-2">
          <input
            id="url-input"
            type="url"
            placeholder="https://www.iherb.com/pr/..."
            disabled={isProcessing}
            className={[
              "flex-1 rounded-lg border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400",
              "outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
              "disabled:bg-gray-50 disabled:cursor-not-allowed",
              errors.url ? "border-red-500 bg-red-50" : "border-gray-300 bg-white",
            ].join(" ")}
            {...register("url")}
          />
          <button
            type="submit"
            disabled={isProcessing}
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition whitespace-nowrap"
          >
            {step.type === "fetching" ? "분석 중..." : "분석"}
          </button>
        </div>
        {errors.url && (
          <p className="mt-1.5 text-sm text-red-600">{errors.url.message}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-xs text-gray-400">예시:</span>
          {[
            { label: "iHerb 상품", url: "https://www.iherb.com/pr/now-foods-glutathione-500-mg-120-veg-capsules/13987" },
          ].map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setValue("url", ex.url)}
              className="text-xs text-indigo-500 underline hover:text-indigo-700"
            >
              {ex.label} 예시
            </button>
          ))}
        </div>
      </form>

      {/* 직접 입력 (폴백) */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowFallback((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>{showFallback ? "▲" : "▼"}</span>
          📋 성분 텍스트 직접 붙여넣기
          <span className="text-xs font-normal text-gray-400">(네이버·쿠팡 등 접근 제한 사이트용)</span>
        </button>

        {showFallback && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              제품 상세 페이지의 성분표(Supplement Facts)를 복사해서 붙여넣으세요.
            </p>
            <textarea
              value={fallbackText}
              onChange={(e) => setFallbackText(e.target.value)}
              placeholder={"예시:\nVitamin C 500mg, Zinc 10mg, Ephedrine HCl 25mg...\n또는\n원재료: 비타민C, 아연, 에페드린..."}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
            <button
              type="button"
              onClick={onFallbackSubmit}
              disabled={isProcessing || !fallbackText.trim()}
              className="w-full rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition"
            >
              {step.type === "checking" ? "검색 중..." : "성분 분석하기"}
            </button>
          </div>
        )}
      </div>

      {/* 페이지 가져오는 중 */}
      {step.type === "fetching" && (
        <div role="status" className="rounded-xl bg-indigo-50 border border-indigo-100 px-6 py-5 space-y-1.5">
          <div className="flex items-center gap-3 text-indigo-700">
            <svg className="h-5 w-5 animate-spin flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm font-medium">제품 페이지에서 성분 정보를 추출하는 중...</span>
          </div>
          <p className="text-xs text-indigo-400 pl-8">최대 15초 소요될 수 있습니다.</p>
        </div>
      )}

      {/* DB 대조 중 */}
      {step.type === "checking" && (
        <div role="status" className="flex items-center gap-3 py-4 text-indigo-600">
          <svg className="h-5 w-5 animate-spin flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-medium">추출된 성분을 식약처 DB와 대조하는 중...</span>
        </div>
      )}

      {/* 에러 */}
      {step.type === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 space-y-2">
          <p className="font-semibold text-red-800 text-sm flex items-center gap-2">
            <span>⚠️</span> 분석 실패
          </p>
          <p className="text-sm text-red-700">{step.message}</p>
          {step.canFallback && (
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              className="mt-1 text-sm font-medium text-indigo-600 underline hover:text-indigo-800"
            >
              → 성분 텍스트 직접 붙여넣기로 분석하기
            </button>
          )}
        </div>
      )}

      {/* 완료 */}
      {step.type === "done" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium mb-0.5">분석된 제품</p>
            <p className="text-sm font-semibold text-gray-900">{step.productName}</p>
          </div>

          {step.tokens.length > 0 && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs font-medium text-gray-600 mb-2">
                추출된 성분 키워드 ({step.tokens.length}개)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {step.tokens.map((t, i) => (
                  <span key={i} className="rounded-full bg-white border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {step.tokens.length === 0 && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-6 py-6 text-center space-y-2">
              <p className="text-2xl">😅</p>
              <p className="font-semibold text-gray-800">성분 정보를 추출하지 못했습니다</p>
              <p className="text-sm text-gray-500">
                아래 직접 입력 기능을 이용해 성분 텍스트를 붙여넣어 보세요.
              </p>
              <button
                type="button"
                onClick={() => setShowFallback(true)}
                className="mt-1 text-sm font-medium text-indigo-600 underline hover:text-indigo-800"
              >
                → 성분 텍스트 직접 붙여넣기
              </button>
            </div>
          )}

          {step.tokens.length > 0 && step.results.length === 0 && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-6 py-6 text-center space-y-1">
              <p className="text-3xl">✅</p>
              <p className="font-semibold text-gray-800">위해성분이 검출되지 않았습니다</p>
              <p className="text-sm text-gray-500">식약처 차단 성분 목록에 일치하는 항목이 없습니다.</p>
            </div>
          )}

          {step.results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-700">
                <span className="font-bold">{step.total}개</span>의 차단 또는 주의 성분이 발견되었습니다
              </p>
              <ul className="space-y-3">
                {step.results.map((item) => (
                  <li key={item.id}>
                    <IngredientCard {...item} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
