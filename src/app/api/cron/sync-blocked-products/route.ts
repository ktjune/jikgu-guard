import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 식품안전나라 OpenAPI: 해외직구 위해식품 차단정보 (I2715)
const BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api'
const SERVICE_ID = 'I2715'
const PAGE_SIZE = 100

interface RawRow {
  SELF_IMPORT_SEQ?: string
  PRDT_NM?: string
  MUFC_NM?: string
  INGR_NM_LST?: string
  STT_YMD?: string
  MUFC_CNTRY_NM?: string
  IMAGE_URL?: string
  [key: string]: string | undefined
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw || !/^\d{8}$/.test(raw)) return null
  return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`)
}

async function fetchPage(apiKey: string, start: number, end: number): Promise<RawRow[]> {
  const url = `${BASE_URL}/${apiKey}/${SERVICE_ID}/json/${start}/${end}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API 오류 ${res.status}`)
  const json = await res.json()
  const rows = json[SERVICE_ID]?.row
  return Array.isArray(rows) ? rows : []
}

export async function GET(request: Request) {
  // cron secret 검증
  const secret = request.headers.get('x-cron-secret') ?? new URL(request.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FOODSAFETY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'FOODSAFETY_API_KEY 없음' }, { status: 500 })
  }

  try {
    // 1페이지로 전체 건수 확인
    const firstUrl = `${BASE_URL}/${apiKey}/${SERVICE_ID}/json/1/${PAGE_SIZE}`
    const firstRes = await fetch(firstUrl, { cache: 'no-store' })
    if (!firstRes.ok) throw new Error(`API 오류 ${firstRes.status}`)
    const firstJson = await firstRes.json()
    const serviceData = firstJson[SERVICE_ID]
    if (!serviceData) throw new Error('API 응답 구조 오류')

    const totalCount = parseInt(serviceData.total_count ?? '0', 10)
    const firstRows: RawRow[] = Array.isArray(serviceData.row) ? serviceData.row : []

    // 나머지 페이지를 3개씩 묶어 순차 조회 (외부 API 부하 분산)
    const pageCount = Math.ceil(totalCount / PAGE_SIZE)
    const CONCURRENT = 3
    const restRows: RawRow[] = []

    for (let page = 2; page <= pageCount; page += CONCURRENT) {
      const batch = Array.from(
        { length: Math.min(CONCURRENT, pageCount - page + 1) },
        (_, i) => page + i,
      )
      const results = await Promise.all(
        batch.map((p) => {
          const start = (p - 1) * PAGE_SIZE + 1
          const end = p * PAGE_SIZE
          return fetchPage(apiKey, start, end).catch(() => [] as RawRow[])
        }),
      )
      restRows.push(...results.flat())
    }

    const allRows = [...firstRows, ...restRows]
    const syncedAt = new Date()

    // 배치 upsert
    let upserted = 0
    const BATCH = 200
    for (let i = 0; i < allRows.length; i += BATCH) {
      const batch = allRows.slice(i, i + BATCH)
      await Promise.all(
        batch.map((row) => {
          const id = row.SELF_IMPORT_SEQ?.trim()
          if (!id) return Promise.resolve()
          return prisma.blockedProduct.upsert({
            where: { id },
            create: {
              id,
              prdlstNm: row.PRDT_NM?.trim()       ?? '(제품명 없음)',
              cmpnyNm:  row.MUFC_NM?.trim()        ?? null,
              hrmflNm:  row.INGR_NM_LST?.trim()    ?? null,
              ntcnDt:   parseDate(row.STT_YMD),
              ctryNm:   row.MUFC_CNTRY_NM?.trim()  ?? null,
              imageUrl: row.IMAGE_URL?.split(',')[0]?.trim() ?? null,
              syncedAt,
            },
            update: {
              prdlstNm: row.PRDT_NM?.trim()       ?? '(제품명 없음)',
              cmpnyNm:  row.MUFC_NM?.trim()        ?? null,
              hrmflNm:  row.INGR_NM_LST?.trim()    ?? null,
              ntcnDt:   parseDate(row.STT_YMD),
              ctryNm:   row.MUFC_CNTRY_NM?.trim()  ?? null,
              imageUrl: row.IMAGE_URL?.split(',')[0]?.trim() ?? null,
              syncedAt,
            },
          })
        }),
      )
      upserted += batch.length
    }

    return NextResponse.json({ ok: true, total: totalCount, upserted, syncedAt })
  } catch (err) {
    console.error('[sync-blocked-products]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 },
    )
  }
}
