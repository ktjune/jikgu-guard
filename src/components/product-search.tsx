"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IngredientCard } from "./ingredient-card";

// ─── 타입 ────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  ingredientsText: string;
}

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

// ─── 스키마 ────────────────────────────────────────────────────────────
const searchSchema = z.object({
  q: z.string().min(1, "제품명을 입력해주세요.").max(100),
});
type SearchForm = z.infer<typeof searchSchema>;

// ─── 성분 텍스트 → 토큰 파싱 ──────────────────────────────────────────
function parseIngredients(text: string): string[] {
  const tokens: string[] = [];
  for (const part of text.split(/[,;·•\n\r]+/)) {
    const cleaned = part
      .replace(/\b\d+\s*(?:mg|g|mcg|µg|%|iu|IU|ml|mL)\b/gi, "")
      .replace(/[()[\]{}*]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 4 && cleaned.length <= 80) {
      tokens.push(cleaned);
    }
  }
  return [...new Set(tokens)];
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────
export default function ProductSearch() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<IngredientResult[]>([]);
  const [checkTokens, setCheckTokens] = useState<string[]>([]);
  const [checkTotal, setCheckTotal] = useState(0);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
  });

  async function onSearch(values: SearchForm) {
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedProduct(null);
    setHasChecked(false);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(values.q)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setProducts(data.products ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
      setProducts([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function checkProduct(product: Product) {
    setSelectedProduct(product);
    setIsChecking(true);
    setCheckError(null);
    setHasChecked(false);
    setCheckResults([]);

    const tokens = parseIngredients(product.ingredientsText);
    setCheckTokens(tokens);

    if (tokens.length === 0) {
      setIsChecking(false);
      setHasChecked(true);
      return;
    }

    try {
      const res = await fetch("/api/ingredients/batch-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setCheckResults(data.results ?? []);
      setCheckTotal(data.total ?? 0);
      setHasChecked(true);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* 검색 폼 */}
      <form onSubmit={handleSubmit(onSearch)} noValidate>
        <div className="mb-4">
          <label htmlFor="product-q" className="block text-sm font-medium text-gray-700 mb-1.5">
            제품명 검색
          </label>
          <div className="flex gap-2">
            <input
              id="product-q"
              type="text"
              placeholder="예: Glutathione, NOW Foods, 글루타치온..."
              className={[
                "flex-1 rounded-lg border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400",
                "outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                errors.q ? "border-red-500 bg-red-50" : "border-gray-300 bg-white",
              ].join(" ")}
              {...register("q")}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition"
            >
              {isSearching ? "검색 중..." : "검색"}
            </button>
          </div>
          {errors.q && <p className="mt-1.5 text-sm text-red-600">{errors.q.message}</p>}
          <p className="mt-1.5 text-xs text-gray-400">
            Open Food Facts DB 기반 · 해외 영양제·건강식품 검색 가능
          </p>
        </div>
      </form>

      {/* 검색 결과 목록 */}
      {hasSearched && !isSearching && (
        <div className="space-y-3">
          {searchError && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
              ⚠️ {searchError}
            </div>
          )}

          {!searchError && products.length === 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-8 text-center space-y-1">
              <p className="text-2xl">🔎</p>
              <p className="font-semibold text-gray-800">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-500">영문 제품명으로 검색해보세요.</p>
            </div>
          )}

          {products.length > 0 && (
            <>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">{products.length}</span>개 제품 발견 — 위해성분을 확인할 제품을 선택하세요
              </p>
              <ul className="space-y-2">
                {products.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => checkProduct(product)}
                      className={[
                        "w-full text-left rounded-xl border px-4 py-3 transition flex items-center gap-3",
                        selectedProduct?.id === product.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {/* 썸네일 */}
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 object-contain rounded-lg bg-gray-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">💊</span>
                        </div>
                      )}
                      {/* 정보 */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        {product.brand && (
                          <p className="text-xs text-gray-500 truncate">{product.brand}</p>
                        )}
                        <p className="text-xs text-indigo-600 mt-0.5">
                          성분 {parseIngredients(product.ingredientsText).length}개 확인 가능
                        </p>
                      </div>
                      <span className="ml-auto text-xs text-gray-400 flex-shrink-0">위해성분 확인 →</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* 선택된 제품 위해성분 검사 결과 */}
      {selectedProduct && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          {/* 선택 제품 헤더 */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            {selectedProduct.imageUrl ? (
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-14 h-14 object-contain rounded-lg bg-gray-50" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                <span className="text-2xl">💊</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
              {selectedProduct.brand && <p className="text-sm text-gray-500">{selectedProduct.brand}</p>}
            </div>
          </div>

          {/* 로딩 */}
          {isChecking && (
            <div role="status" className="flex items-center gap-3 text-indigo-600 py-4">
              <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-sm font-medium">식약처 DB와 대조 중...</span>
            </div>
          )}

          {/* 에러 */}
          {!isChecking && checkError && (
            <p className="text-sm text-red-600">⚠️ {checkError}</p>
          )}

          {/* 결과 */}
          {!isChecking && hasChecked && (
            <div className="space-y-4">

              {/* 추출된 성분 목록 */}
              {checkTokens.length > 0 && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    DB에서 추출된 성분 ({checkTokens.length}개)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {checkTokens.map((t, i) => (
                      <span key={i} className="rounded-full bg-white border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 위해성분 없음 */}
              {checkResults.length === 0 && (
                <div className="rounded-xl bg-safe-50 border border-safe-500 px-6 py-6 text-center space-y-1">
                  <p className="text-3xl">✅</p>
                  <p className="font-semibold text-gray-800">위해성분이 검출되지 않았습니다</p>
                  <p className="text-sm text-gray-500">식약처 차단 성분 목록에 일치하는 항목이 없습니다.</p>
                </div>
              )}

              {/* 위해성분 발견 */}
              {checkResults.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    <span className="font-bold text-danger-600">{checkTotal}개</span>의 위해가능 성분이 발견되었습니다
                  </p>
                  <ul className="space-y-3">
                    {checkResults.map((item) => (
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
      )}
    </div>
  );
}
