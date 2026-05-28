interface IngredientCardProps {
  id: string
  rawIrdntNm: string
  rawIrdntEngNm: string | null
  rawIrdntEtcNm: string | null
  appnRelsDvs: boolean
  appnDt: string | null
  relsDt: string | null
  appnRsn: string | null
  relsRsn: string | null
  syncedAt: string
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  // ISO string의 앞 10자(YYYY-MM-DD)만 사용 — Date 파싱 없이 타임존 영향 없음
  return iso.slice(0, 10)
}

export function IngredientCard({
  rawIrdntNm,
  rawIrdntEngNm,
  rawIrdntEtcNm,
  appnRelsDvs,
  appnDt,
  relsDt,
  appnRsn,
  relsRsn,
  syncedAt,
}: IngredientCardProps) {
  const isBlocked = appnRelsDvs

  const cardBase =
    'rounded-lg border border-l-4 p-4 shadow-sm space-y-3'
  const cardTheme = isBlocked
    ? 'bg-danger-50 border-danger-500'
    : 'bg-safe-50 border-safe-500'

  const badgeTheme = isBlocked
    ? 'bg-danger-600 text-white'
    : 'bg-safe-600 text-white'

  const badgeLabel = isBlocked ? '⚠️ 차단' : '✅ 해제'

  // 상태별 날짜·사유
  const dateLabel = isBlocked ? '지정일자' : '해제일자'
  const dateValue = isBlocked ? formatDate(appnDt) : formatDate(relsDt)
  const reasonLabel = isBlocked ? '지정사유' : '해제사유'
  const reasonValue = isBlocked ? appnRsn : relsRsn

  return (
    <article className={`${cardBase} ${cardTheme}`} aria-label={`성분 카드: ${rawIrdntNm}`}>
      {/* 상단: 성분명 + 뱃지 */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-gray-900 leading-snug">
          {rawIrdntNm}
        </h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${badgeTheme}`}
          aria-label={isBlocked ? '현재 차단 중인 성분' : '차단 해제된 성분'}
        >
          {badgeLabel}
        </span>
      </div>

      {/* 영문 성분명 */}
      {rawIrdntEngNm && (
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-600">영문명</span>{' '}
          {rawIrdntEngNm}
        </p>
      )}

      {/* 기타 명칭 */}
      {rawIrdntEtcNm && (
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-600">기타 명칭</span>{' '}
          {rawIrdntEtcNm}
        </p>
      )}

      {/* 날짜 */}
      {dateValue && (
        <p className="text-sm text-gray-700">
          <span className="font-medium">{dateLabel}</span>{' '}
          {dateValue}
        </p>
      )}

      {/* 사유 */}
      {reasonValue && (
        <p className="text-sm text-gray-700">
          <span className="font-medium">{reasonLabel}</span>{' '}
          {reasonValue}
        </p>
      )}

      {/* 하단: 출처 */}
      <footer className="border-t border-gray-200 pt-2">
        <p className="text-xs text-gray-400">
          출처:{' '}
          <a
            href="https://www.mfds.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
          >
            식약처
          </a>{' '}
          ({formatDate(syncedAt)})
        </p>
      </footer>
    </article>
  )
}
