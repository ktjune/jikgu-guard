"use client";

import { useState, useRef, useEffect, DragEvent, ClipboardEvent } from "react";
import { IngredientCard } from "./ingredient-card";

// ─── 타입 ─────────────────────────────────────────────────────────────
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

interface SearchSource {
  name: string;
  url: string;
  lastSyncedAt: string | null;
}

export interface RecentItem {
  id: string;
  rawIrdntNm: string;
  rawIrdntEngNm: string | null;
  appnDt: string | null;
  appnRsn: string | null;
}

type AnalysisMode = "ingredient" | "url" | "ocr" | "product";

interface ProductCandidate {
  id: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  ingredientsText: string;
}

type Step =
  | { type: "idle" }
  | { type: "loading"; message: string }
  | { type: "select"; products: ProductCandidate[]; query: string }
  | { type: "notfound"; query: string }
  | {
      type: "done";
      mode: AnalysisMode;
      productName?: string;
      tokens?: string[];
      results: IngredientResult[];
      total: number;
      hasMore?: boolean;
      source?: SearchSource;
    }
  | { type: "error"; message: string };

// ─── 성분 토큰 파싱 ──────────────────────────────────────────────────
const STOPWORDS = new Set([
  "and", "or", "with", "the", "of", "in", "for", "from", "by", "as",
  "other", "each", "per", "contains", "including", "plus", "made",
  "이상", "이하", "미만", "포함", "해당", "기타", "성분", "함량",
]);

function parseTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const line of text.split(/[\n\r]+/)) {
    for (const part of line.split(/[,;·•\/|:]+/)) {
      const cleaned = part
        .replace(/\b\d+\s*(?:mg|g|mcg|µg|%|iu|IU|ml|mL|RE|NE|mcg RAE)\b/gi, "")
        .replace(/[()[\]{}*#@!?]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const lower = cleaned.toLowerCase();
      if (cleaned.length >= 2 && cleaned.length <= 80 && !STOPWORDS.has(lower) && !/^\d+$/.test(cleaned)) {
        tokens.push(cleaned);
      }
    }
  }
  return [...new Set(tokens)];
}

// ─── Props ────────────────────────────────────────────────────────────
interface UnifiedSearchProps {
  initialQ?: string;
  initialStatus?: "all" | "blocked" | "released";
  recentItems?: RecentItem[];
}

// ─── 통합 검색 컴포넌트 ───────────────────────────────────────────────
export default function UnifiedSearch({
  initialQ = "",
  initialStatus = "all",
  recentItems = [],
}: UnifiedSearchProps) {
  const [query, setQuery] = useState(initialQ);
  const [status, setStatus] = useState<"all" | "blocked" | "released">(initialStatus);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<Step>({ type: "idle" });
  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL 파라미터로 초기 검색
  useEffect(() => {
    if (initialQ) runIngredientSearch(initialQ, initialStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 이미지 처리 ────────────────────────────────────────────────────
  function selectImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    setQuery("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) selectImage(file);
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/")
    );
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) selectImage(file);
    }
  }

  // ─── 분석 진입점 ────────────────────────────────────────────────────
  async function handleAnalyze() {
    const trimmed = query.trim();
    if (imageFile) {
      await runOcr();
    } else if (/^https?:\/\//i.test(trimmed)) {
      await runUrlAnalysis(trimmed);
    } else if (trimmed) {
      const urlParams = new URLSearchParams({ q: trimmed });
      if (status !== "all") urlParams.set("status", status);
      window.history.replaceState(null, "", `?${urlParams.toString()}`);

      // 쉼표·단위·캡슐 등이 있으면 성분 리스트로 취급 → 토큰화 후 batch-search
      const looksLikeIngredientList =
        /[,;·•\/|]/.test(trimmed) ||
        /\d+\s*(?:mg|g|mcg|µg|%|iu|IU|ml|mL|캡슐|정|알|tablet|capsule)/i.test(trimmed);

      if (looksLikeIngredientList) {
        await runTextBatchSearch(trimmed);
      } else {
        await runIngredientSearch(trimmed, status);
      }
    }
  }

  // ─── batch-search 공통 ──────────────────────────────────────────────
  async function batchSearch(
    tokens: string[],
    productName: string | undefined,
    mode: AnalysisMode
  ) {
    const res = await fetch("/api/ingredients/batch-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    setStep({
      type: "done",
      mode,
      productName,
      tokens,
      results: data.results ?? [],
      total: data.total ?? 0,
    });
  }

  // ─── 텍스트 성분 리스트 → batch-search ─────────────────────────────
  async function runTextBatchSearch(text: string) {
    const tokens = parseTokens(text);
    if (tokens.length === 0) {
      await runIngredientSearch(text, status);
      return;
    }
    setStep({ type: "loading", message: "성분을 식약처 DB와 대조 중..." });
    try {
      await batchSearch(tokens, undefined, "ingredient");
    } catch (err) {
      setStep({ type: "error", message: err instanceof Error ? err.message : "분석 실패" });
    }
  }

  // ─── OCR ────────────────────────────────────────────────────────────
  async function runOcr() {
    setStep({ type: "loading", message: "라벨 이미지에서 성분 추출 중... (최대 60초)" });
    const formData = new FormData();
    formData.append("image", imageFile!);
    try {
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const text = await res.text();
      let data: { ok: boolean; error?: string; tokens?: string[] };
      try {
        data = JSON.parse(text);
      } catch {
        // Vercel 타임아웃·서버 오류 시 HTML 반환 → 사용자 친화적 메시지
        throw new Error("OCR 서버 오류가 발생했습니다. 라벨의 성분표 부분만 잘라서 다시 시도하거나, 성분명을 직접 입력해주세요.");
      }
      if (!data.ok) throw new Error(data.error);
      const tokens: string[] = data.tokens ?? [];
      if (tokens.length === 0) {
        setStep({ type: "done", mode: "ocr", tokens: [], results: [], total: 0 });
        return;
      }
      setStep({ type: "loading", message: "추출된 성분을 식약처 DB와 대조 중..." });
      await batchSearch(tokens, "라벨 OCR 분석", "ocr");
    } catch (err) {
      setStep({ type: "error", message: err instanceof Error ? err.message : "OCR 분석 실패" });
    }
  }

  // ─── URL 분석 ───────────────────────────────────────────────────────
  async function runUrlAnalysis(url: string) {
    setStep({ type: "loading", message: "제품 페이지 분석 중..." });
    try {
      const res = await fetch("/api/products/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const tokens: string[] = data.tokens ?? [];
      if (tokens.length === 0) {
        setStep({ type: "done", mode: "url", productName: data.productName, tokens: [], results: [], total: 0 });
        return;
      }
      setStep({ type: "loading", message: "식약처 DB와 대조 중..." });
      await batchSearch(tokens, data.productName || "분석된 제품", "url");
    } catch (err) {
      setStep({ type: "error", message: err instanceof Error ? err.message : "링크 분석 실패" });
    }
  }

  // ─── 성분명 검색 → 0건이면 제품명 검색으로 fallback ─────────────────
  async function runIngredientSearch(q: string, st: "all" | "blocked" | "released") {
    setStep({ type: "loading", message: "성분 검색 중..." });
    try {
      const res = await fetch(`/api/ingredients/search?${new URLSearchParams({ q, status: st })}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const results: IngredientResult[] = data.results ?? [];
      if (results.length === 0 && q.trim().split(/\s+/).length >= 2) {
        // 여러 단어 → 제품명 검색 시도
        await runProductSearch(q);
        return;
      }
      setStep({
        type: "done",
        mode: "ingredient",
        results,
        total: data.total ?? 0,
        hasMore: data.hasMore,
        source: data.source,
      });
    } catch (err) {
      setStep({ type: "error", message: err instanceof Error ? err.message : "검색 실패" });
    }
  }

  // ─── 제품명 검색 fallback ────────────────────────────────────────────
  async function runProductSearch(q: string) {
    setStep({ type: "loading", message: `"${q}" 제품 검색 중...` });
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const products: ProductCandidate[] = (data.products ?? []).filter(
        (p: ProductCandidate) => p.ingredientsText
      );
      if (products.length === 0) {
        setStep({ type: "notfound", query: q });
        return;
      }
      // 제품 목록 보여주고 사용자가 선택
      setStep({ type: "select", products, query: q });
    } catch (err) {
      setStep({ type: "error", message: err instanceof Error ? err.message : "제품 검색 실패" });
    }
  }

  // ─── 제품 선택 후 성분 분석 ──────────────────────────────────────────
  async function analyzeProduct(product: ProductCandidate) {
    const tokens = parseTokens(product.ingredientsText);
    if (tokens.length === 0) {
      setStep({ type: "done", mode: "product", productName: product.name, tokens: [], results: [], total: 0 });
      return;
    }
    setStep({ type: "loading", message: `"${product.name}" 성분을 식약처 DB와 대조 중...` });
    await batchSearch(tokens, product.name, "product");
  }

  const isLoading = step.type === "loading";
  const isIdle = step.type === "idle";
  const canAnalyze = !isLoading && (!!imageFile || !!query.trim());
  const showStatusFilter = !imagePreview && !/^https?:\/\//i.test(query.trim());

  return (
    <div className="space-y-6">

      {/* ── 통합 입력 카드 ── */}
      <div
        className={[
          "relative rounded-2xl bg-white shadow-md ring-1 transition-all duration-150",
          isDragging ? "ring-2 ring-indigo-400 bg-indigo-50/60" : "ring-gray-100",
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 드래그 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl z-10 pointer-events-none gap-2">
            <p className="text-4xl">📷</p>
            <p className="text-sm font-semibold text-indigo-700">이미지를 여기에 놓으세요</p>
          </div>
        )}

        <div className={["p-5 space-y-3", isDragging ? "opacity-20" : ""].join(" ")}>

          {/* 이미지 미리보기 */}
          {imagePreview && (
            <div className="flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="업로드된 라벨" className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-indigo-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-indigo-800">라벨 사진 선택됨</p>
                <p className="text-xs text-indigo-500 mt-0.5 truncate">{imageFile?.name}</p>
                <p className="text-xs text-indigo-400 mt-1">분석하기 버튼을 눌러 OCR을 실행하세요</p>
              </div>
              <button
                onClick={clearImage}
                className="text-indigo-300 hover:text-indigo-600 flex-shrink-0 text-xl leading-none"
                aria-label="이미지 제거"
              >
                ×
              </button>
            </div>
          )}

          {/* 텍스트 입력 */}
          {!imagePreview && (
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canAnalyze) handleAnalyze();
                }
              }}
              placeholder="성분명·제품명·구매링크를 입력하거나 라벨 사진을 드래그 / Ctrl+V"
              rows={2}
              disabled={isLoading}
              className={[
                "w-full resize-none rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400",
                "outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                "disabled:bg-gray-50 disabled:cursor-not-allowed border-gray-200",
              ].join(" ")}
            />
          )}

          {/* 하단 액션 행 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 사진 업로드 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40"
            >
              📷 사진 업로드
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) selectImage(f);
              }}
            />

            {/* 상태 필터 */}
            {showStatusFilter && (
              <div className="flex gap-1">
                {(["all", "blocked", "released"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      status === s
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {s === "all" ? "전체" : s === "blocked" ? "차단 중" : "해제됨"}
                  </button>
                ))}
              </div>
            )}

            {/* 분석 버튼 */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={[
                "ml-auto rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                canAnalyze ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed",
              ].join(" ")}
            >
              {isLoading ? "분석 중..." : "분석하기"}
            </button>
          </div>

          {/* 힌트 */}
          {isIdle && (
            <p className="text-xs text-gray-400 text-center pt-1">
              URL 자동 감지 · 사진 드래그 & Ctrl+V 지원 · Enter로 검색
            </p>
          )}
        </div>
      </div>

      {/* ── 로딩 ── */}
      {step.type === "loading" && (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-12 text-indigo-600">
          <svg className="h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-medium">{step.message}</span>
        </div>
      )}

      {/* ── 제품 선택 ── */}
      {step.type === "select" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              🛒 &quot;{step.query}&quot; 검색 결과 — 분석할 제품을 선택하세요
            </p>
            <span className="text-xs text-gray-400">{step.products.length}개</span>
          </div>
          <ul className="space-y-2">
            {step.products.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => analyzeProduct(p)}
                  className="w-full text-left flex items-center gap-3 rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3 hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-12 h-12 rounded-lg object-contain border border-gray-100 flex-shrink-0 bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    {p.brand && <p className="text-xs text-gray-400 truncate">{p.brand}</p>}
                  </div>
                  <span className="text-indigo-500 text-xs font-medium shrink-0">분석 →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 제품 없음 ── */}
      {step.type === "notfound" && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-8 text-center space-y-4">
          <p className="text-4xl">🔍</p>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">
              &quot;{step.query}&quot; 제품을 찾을 수 없습니다.
            </p>
            <p className="text-sm text-gray-500">
              제품 데이터베이스에 등록되지 않은 제품입니다.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setStep({ type: "idle" });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              📷 라벨 사진 업로드
            </button>
            <button
              onClick={() => {
                setQuery("");
                setStep({ type: "idle" });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 text-gray-600 px-5 py-2.5 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              🔗 구매링크 붙여넣기
            </button>
          </div>
          <p className="text-xs text-gray-400">
            iHerb·Amazon 링크 또는 제품 라벨 사진으로 성분을 분석할 수 있습니다.
          </p>
        </div>
      )}

      {/* ── 에러 ── */}
      {step.type === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">⚠️</span>
          <div>
            <p className="font-semibold text-red-800 text-sm">분석 실패</p>
            <p className="mt-0.5 text-sm text-red-700">{step.message}</p>
          </div>
        </div>
      )}

      {/* ── 결과 ── */}
      {step.type === "done" && (
        <div className="space-y-4">

          {/* 분석 모드 & 제품명 */}
          {step.productName && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">
                {step.mode === "ocr" ? "📷 라벨 OCR 분석" :
                 step.mode === "url" ? "🔗 구매링크 분석" :
                 step.mode === "product" ? "🛒 제품명 검색" : "🔤 성분 검색"}
              </p>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{step.productName}</p>
            </div>
          )}

          {/* 추출된 성분 토큰 */}
          {step.tokens && step.tokens.length > 0 && (
            <details className="rounded-lg bg-gray-50 border border-gray-200">
              <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-gray-500 list-none flex items-center gap-1">
                <span>▶</span> 추출된 성분 키워드 ({step.tokens.length}개)
              </summary>
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {step.tokens.map((t, i) => (
                  <span key={i} className="rounded-full bg-white border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700">{t}</span>
                ))}
              </div>
            </details>
          )}

          {/* 출처 (성분 검색) */}
          {step.source && (
            <div className="flex flex-wrap items-center justify-between gap-y-1 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 text-xs text-indigo-700">
              <span className="font-medium">
                출처:{" "}
                <a href={step.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                  {step.source.name}
                </a>
              </span>
              {step.source.lastSyncedAt && (
                <span className="text-indigo-500">마지막 업데이트: {step.source.lastSyncedAt.slice(0, 10)}</span>
              )}
            </div>
          )}

          {/* 결과 수 + 링크 복사 */}
          {(step.results.length > 0 || step.mode === "ingredient") && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-600 font-medium" aria-live="polite">
                총 <span className="font-bold text-gray-900">{step.total.toLocaleString()}</span>건
                {step.hasMore && <span className="ml-1 text-gray-400 font-normal">(상위 50건 표시)</span>}
              </p>
              {step.mode === "ingredient" && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                      .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); })
                      .catch(() => {});
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
                >
                  {linkCopied ? "✅ 복사됨!" : "🔗 결과 링크 복사"}
                </button>
              )}
            </div>
          )}

          {/* 위해성분 없음 (URL/OCR/제품) */}
          {step.tokens !== undefined && step.tokens.length > 0 && step.results.length === 0 && (
            <div className="rounded-2xl bg-green-50 border border-green-200 px-6 py-8 text-center space-y-2">
              <p className="text-4xl">✅</p>
              <p className="font-semibold text-gray-800">위해성분이 검출되지 않았습니다</p>
              <p className="text-sm text-gray-500">식약처 차단 성분 목록에 일치하는 항목이 없습니다.</p>
            </div>
          )}

          {/* 성분 추출 실패 */}
          {step.tokens !== undefined && step.tokens.length === 0 && (
            <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-6 py-8 text-center space-y-2">
              <p className="text-4xl">😅</p>
              <p className="font-semibold text-gray-800">성분 정보를 추출하지 못했습니다</p>
              <p className="text-sm text-gray-500">
                제품 상세 페이지에서 성분표 텍스트를 복사해 입력란에 붙여넣어보세요.
              </p>
            </div>
          )}

          {/* 검색 결과 없음 (성분 검색) */}
          {step.mode === "ingredient" && step.tokens === undefined && step.results.length === 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-10 text-center space-y-2">
              <p className="text-3xl" aria-hidden="true">🔎</p>
              <p className="font-semibold text-gray-800">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-500">
                성분명의 철자를 다시 확인하거나, 영문명으로도 검색해 보세요.
              </p>
            </div>
          )}

          {/* 결과 목록 */}
          {step.results.length > 0 && (
            <ul className="space-y-4" aria-label="성분 검색 결과 목록">
              {step.results.map((item) => (
                <li key={item.id}>
                  <IngredientCard {...item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── 초기 안내 (검색 전) ── */}
      {isIdle && (
        <div className="space-y-5">
          {/* 최근 차단 성분 */}
          {recentItems.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-5 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">🚨 최근 차단 지정 성분</h2>
                <span className="text-xs text-gray-400">식약처 최신 고시 기준</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {recentItems.map((item) => (
                  <li key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.rawIrdntNm}</p>
                      {item.rawIrdntEngNm && (
                        <p className="text-xs text-gray-500 truncate">{item.rawIrdntEngNm}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">
                        ⚠️ 차단
                      </span>
                      {item.appnDt && (
                        <p className="mt-1 text-xs text-gray-400">{item.appnDt.slice(0, 10)}</p>
                      )}
                    </div>
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
