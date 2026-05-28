'use client'

import { useState, useMemo } from 'react'

export interface IngredientRow {
  id: string
  rawIrdntNm: string
  rawIrdntEngNm: string | null
  rawIrdntEtcNm: string | null
  appnRelsDvs: boolean // true = 차단 중, false = 해제됨
  appnDt: string | null
  relsDt: string | null
  appnRsn: string | null
  relsRsn: string | null
  syncedAt: string
}

type FilterTab = 'all' | 'blocked' | 'released'

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

function ReasonText({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return <span className="text-gray-400">-</span>

  const isLong = text.length > 80
  const displayed = isLong && !expanded ? text.slice(0, 80) + '…' : text

  return (
    <span className="text-gray-600 text-sm leading-relaxed">
      {displayed}
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-indigo-600 hover:underline text-xs font-medium"
          aria-expanded={expanded}
        >
          {expanded ? '접기' : '더보기'}
        </button>
      )}
    </span>
  )
}

function IngredientItem({ item }: { item: IngredientRow }) {
  const isBlocked = item.appnRelsDvs

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-2 mb-3">
        {/* 이름 */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-snug break-words">
            {item.rawIrdntNm}
          </p>
          {item.rawIrdntEngNm && (
            <p className="text-sm text-gray-500 mt-0.5 break-words">
              {item.rawIrdntEngNm}
            </p>
          )}
          {item.rawIrdntEtcNm && (
            <p className="text-xs text-gray-400 mt-0.5 break-words">
              기타명: {item.rawIrdntEtcNm}
            </p>
          )}
        </div>
        {/* 상태 뱃지 */}
        {isBlocked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 text-red-700 px-3 py-1 text-sm font-medium shrink-0">
            ⚠️ 차단 중
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 text-green-700 px-3 py-1 text-sm font-medium shrink-0">
            ✅ 해제됨
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <span className="text-gray-400 shrink-0">지정일</span>
          <span className="text-gray-700">{formatDate(item.appnDt)}</span>
        </div>
        {item.appnRsn && (
          <div>
            <span className="text-gray-400 block mb-0.5">지정사유</span>
            <ReasonText text={item.appnRsn} />
          </div>
        )}
        {!isBlocked && item.relsDt && (
          <div className="flex flex-wrap gap-x-2">
            <span className="text-gray-400 shrink-0">해제일</span>
            <span className="text-gray-700">{formatDate(item.relsDt)}</span>
          </div>
        )}
        {!isBlocked && item.relsRsn && (
          <div>
            <span className="text-gray-400 block mb-0.5">해제사유</span>
            <ReasonText text={item.relsRsn} />
          </div>
        )}
      </div>
    </article>
  )
}

export default function IngredientsClient({
  ingredients,
}: {
  ingredients: IngredientRow[]
}) {
  const [tab, setTab] = useState<FilterTab>('all')
  const [query, setQuery] = useState('')

  const blockedCount = useMemo(
    () => ingredients.filter((i) => i.appnRelsDvs).length,
    [ingredients],
  )
  const releasedCount = ingredients.length - blockedCount

  const filtered = useMemo(() => {
    let list = ingredients
    if (tab === 'blocked') list = list.filter((i) => i.appnRelsDvs)
    if (tab === 'released') list = list.filter((i) => !i.appnRelsDvs)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.rawIrdntNm.toLowerCase().includes(q) ||
          (i.rawIrdntEngNm?.toLowerCase().includes(q) ?? false) ||
          (i.rawIrdntEtcNm?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [ingredients, tab, query])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'blocked', label: '차단 중' },
    { key: 'released', label: '해제됨' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          차단 성분 목록
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          식약처 해외직구식품 국내 반입차단 대상 원료성분 전체 목록
        </p>

        {/* 카운트 뱃지 */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 text-red-700 px-3 py-1 text-sm font-medium">
            🚫 차단 중 {blockedCount.toLocaleString()}개
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 text-green-700 px-3 py-1 text-sm font-medium">
            ✅ 해제됨 {releasedCount.toLocaleString()}개
          </span>
        </div>
      </header>

      {/* 필터 탭 */}
      <div
        className="flex gap-2 mb-4"
        role="tablist"
        aria-label="성분 상태 필터"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 검색 입력 */}
      <div className="relative mb-5">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
          aria-hidden="true"
        >
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="성분명 또는 영문명 검색..."
          aria-label="성분명 검색"
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
      </div>

      {/* 결과 수 */}
      <p className="text-xs text-gray-400 mb-4">
        총 {filtered.length.toLocaleString()}개
      </p>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">❓</p>
          <p className="text-sm">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {filtered.map((item) => (
            <li key={item.id}>
              <IngredientItem item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
