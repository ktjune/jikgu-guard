"use client";

import { useState, useRef } from "react";
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

interface OcrApiResponse {
  ok: boolean;
  text?: string;
  tokens?: string[];
  error?: string;
}

interface BatchSearchResponse {
  ok: boolean;
  results?: IngredientResult[];
  total?: number;
  error?: string;
}

type OcrStep =
  | { type: "idle" }
  | { type: "uploading" }       // 서버 OCR 처리 중
  | { type: "searching" }       // DB 검색 중
  | { type: "done"; tokens: string[]; results: IngredientResult[]; total: number }
  | { type: "error"; message: string };

// ─── 컴포넌트 ─────────────────────────────────────────────────────────
export default function OcrUpload() {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [step, setStep] = useState<OcrStep>({ type: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setStep({ type: "error", message: "이미지 파일만 업로드 가능합니다." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStep({ type: "error", message: "파일 크기는 5MB 이하여야 합니다." });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(objectUrl);
    runOcrPipeline(file);
  }

  async function runOcrPipeline(file: File) {
    setStep({ type: "uploading" });

    // 1단계: 서버에서 OCR 실행
    let tokens: string[] = [];
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data: OcrApiResponse = await res.json();
      if (!data.ok) throw new Error(data.error ?? "OCR 처리 중 오류가 발생했습니다.");
      tokens = data.tokens ?? [];
    } catch (err) {
      setStep({
        type: "error",
        message: err instanceof Error ? err.message : "OCR 처리 중 오류가 발생했습니다.",
      });
      return;
    }

    if (tokens.length === 0) {
      setStep({ type: "done", tokens: [], results: [], total: 0 });
      return;
    }

    // 2단계: DB에서 위해성분 매칭
    setStep({ type: "searching" });
    try {
      const res = await fetch("/api/ingredients/batch-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const data: BatchSearchResponse = await res.json();
      if (!data.ok) throw new Error(data.error ?? "검색 중 오류가 발생했습니다.");
      setStep({
        type: "done",
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

  const isProcessing = step.type === "uploading" || step.type === "searching";

  return (
    <div className="space-y-6">

      {/* 업로드 영역 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="라벨 사진 업로드 영역"
        aria-disabled={isProcessing}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition",
          isProcessing
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            : isDragOver
            ? "cursor-pointer border-indigo-500 bg-indigo-50"
            : "cursor-pointer border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50",
        ].join(" ")}
        onClick={() => !isProcessing && inputRef.current?.click()}
        onKeyDown={(e) => { if (!isProcessing && (e.key === "Enter" || e.key === " ")) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); if (!isProcessing) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!isProcessing) {
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }
        }}
      >
        <span className="text-4xl" aria-hidden="true">📷</span>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-gray-700">성분표 사진을 업로드하세요</p>
          <p className="text-xs text-gray-500">클릭하거나 드래그 · JPG, PNG, WEBP · 최대 5MB</p>
          <p className="text-xs text-amber-600 font-medium mt-1">
            ⚠️ 제품 뒷면의 <span className="underline">성분표(Supplement Facts) 부분만</span> 촬영한 사진을 올려주세요
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden="true"
          disabled={isProcessing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* 이미지 미리보기 */}
      {preview && (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <img src={preview} alt="업로드된 라벨 이미지" className="w-full max-h-64 object-contain bg-gray-50" />
        </div>
      )}

      {/* OCR 처리 중 */}
      {step.type === "uploading" && (
        <div role="status" aria-live="polite" className="rounded-xl bg-indigo-50 border border-indigo-100 px-6 py-5 space-y-2">
          <div className="flex items-center gap-3 text-indigo-700">
            <svg className="h-5 w-5 animate-spin flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm font-medium">이미지에서 성분 텍스트를 추출하는 중...</span>
          </div>
          <p className="text-xs text-indigo-500 pl-8">처음 실행 시 최대 30초 소요될 수 있습니다.</p>
        </div>
      )}

      {/* DB 검색 중 */}
      {step.type === "searching" && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 py-4 text-indigo-600">
          <svg className="h-5 w-5 animate-spin flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-medium">추출된 성분을 식약처 DB와 대조하는 중...</span>
        </div>
      )}

      {/* 에러 */}
      {step.type === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">⚠️</span>
          <div>
            <p className="font-semibold text-red-800 text-sm">오류가 발생했습니다</p>
            <p className="mt-0.5 text-sm text-red-700">{step.message}</p>
          </div>
        </div>
      )}

      {/* 완료 */}
      {step.type === "done" && (
        <div className="space-y-4">

          {/* 추출된 토큰 */}
          {step.tokens.length > 0 && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs font-medium text-gray-600 mb-2">
                이미지에서 추출된 성분 키워드 ({step.tokens.length}개)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {step.tokens.map((t, i) => (
                  <span key={i} className="rounded-full bg-white border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* 결과 없음 */}
          {step.results.length === 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-10 text-center space-y-2">
              <p className="text-3xl" aria-hidden="true">✅</p>
              <p className="font-semibold text-gray-800">위해성분이 검출되지 않았습니다</p>
              <p className="text-sm text-gray-500">
                {step.tokens.length === 0
                  ? "이미지에서 성분 텍스트를 인식하지 못했습니다. 더 선명한 사진으로 시도해보세요."
                  : "식약처 차단 성분 목록에 일치하는 항목이 없습니다."}
              </p>
            </div>
          )}

          {/* 위해성분 발견 */}
          {step.results.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700" aria-live="polite">
                <span className="font-bold text-danger-600">{step.total.toLocaleString()}개</span>의 위해가능 성분이 발견되었습니다
              </p>
              <ul className="space-y-4" aria-label="위해성분 검출 결과">
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
