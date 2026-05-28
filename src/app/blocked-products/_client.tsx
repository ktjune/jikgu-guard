'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { BlockedProduct } from '@/app/api/blocked-products/route'

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

function ProductCard({ item }: { item: BlockedProduct }) {
  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex gap-4">
      {item.imageUrl && (
        <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.prdlstNm}
            className="object-contain w-full h-full"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-2">
        <h2 className="font-bold text-gray-900 text-base leading-snug break-words">
          {item.prdlstNm}
        </h2>

        {item.hrmflNm && (
          <div className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-sm font-medium text-red-700">
            ⚠️ {item.hrmflNm}
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {item.cmpnyNm && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">제조업체</dt>
              <dd className="text-gray-700">{item.cmpnyNm}</dd>
            </div>
          )}
          {item.ctryNm && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">원산지</dt>
              <dd className="text-gray-700">{item.ctryNm}</dd>
            </div>
          )}
          {item.ntcnDt && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">통보일자</dt>
              <dd className="text-gray-500 text-xs">{formatDate(item.ntcnDt)}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}

interface ApiResponse {
  ok: boolean
  products: BlockedProduct[]
  total: number
  page: number
  totalPages: number
  error?: string
}

export default function BlockedProductsClient() {
  const [products, setProducts] = useState<BlockedProduct[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dbEmpty, setDbEmpty] = useState(false)

  const fetchProducts = useCallback(async (q: string, page: number, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set('q', q)
      const res = await fetch(`/api/blocked-products?${params}`)
      const data: ApiResponse = await res.json()
      if (!data.ok) throw new Error(data.error ?? '알 수 없는 오류')

      setProducts((prev) => (append ? [...prev, ...data.products] : data.products))
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setCurrentPage(page)
      setDbEmpty(data.total === 0 && !q)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts('', 1)
  }, [fetchProducts])

  // 검색 디바운스
  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(value)
      setProducts([])
      fetchProducts(value.trim(), 1)
    }, 350)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          ⚠️ 해외직구 위해 제품 목록
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          식품안전나라 해외직구 위해식품 차단정보 (I2715) · 최신순
        </p>
        {!loading && total > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            {query
              ? <>검색 결과 <strong className="text-gray-700">{total.toLocaleString()}</strong>건</>
              : <>전체 <strong className="text-gray-700">{total.toLocaleString()}</strong>건</>
            }
          </p>
        )}
      </header>

      {/* DB가 비어있을 때 동기화 안내 */}
      {!loading && dbEmpty ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <p className="text-5xl">📦</p>
          <p className="font-semibold text-gray-700">아직 데이터가 없습니다.</p>
          <p className="text-sm text-gray-500">
            아래 버튼으로 식품안전나라 데이터를 동기화하세요.<br />
            (최초 1회, 이후 자동 갱신)
          </p>
          <SyncButton onDone={() => fetchProducts('', 1)} />
          <Link
            href="/ingredients"
            className="block text-sm text-indigo-600 hover:underline"
          >
            차단 성분 목록으로 보기
          </Link>
        </div>
      ) : (
        <>
          {/* 검색 */}
          {!loading && (
            <div className="relative mb-5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                🔍
              </span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="제품명·위해성분·업체명·원산지 검색..."
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm">위해 제품 목록 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3">
              <p className="text-5xl">❓</p>
              <p className="font-semibold text-gray-700">데이터를 불러올 수 없습니다.</p>
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 inline-block">{error}</p>
              <button
                onClick={() => fetchProducts(query, 1)}
                className="block mx-auto rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">❓</p>
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3" role="list">
                {products.map((item) => (
                  <li key={item.id}>
                    <ProductCard item={item} />
                  </li>
                ))}
              </ul>

              {currentPage < totalPages && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => fetchProducts(query, currentPage + 1, true)}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-300 text-indigo-600 px-6 py-2.5 text-sm font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                        불러오는 중...
                      </>
                    ) : (
                      `다음 100건 더 보기 (${products.length} / ${total.toLocaleString()})`
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function SyncButton({ onDone }: { onDone: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/trigger-sync', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setResult(`✅ ${data.upserted}건 동기화 완료`)
        onDone()
      } else {
        setResult(`❌ ${data.error}`)
      }
    } catch {
      setResult('❌ 동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {syncing ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            동기화 중... (수 분 소요)
          </>
        ) : '식품안전나라 데이터 동기화'}
      </button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  )
}
