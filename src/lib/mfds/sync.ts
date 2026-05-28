import { prisma } from '@/lib/prisma'
import { mapBlockedIngredient } from './mappers'
import type { MfdsApiResponse } from './types'

const BASE_URL =
  'https://apis.data.go.kr/1471000/BlockRawIrdntInfoService/getBlockRawIrdntInfo'
const PAGE_SIZE = 100

export async function fetchAndUpsertBlockedIngredients(): Promise<{
  upserted: number
  total: number
}> {
  const apiKey = process.env.MFDS_API_KEY
  if (!apiKey) throw new Error('MFDS_API_KEY 환경변수가 설정되지 않았습니다.')

  const syncedAt = new Date()
  let pageNo = 1
  let total = 0
  let upserted = 0

  while (true) {
    const url = new URL(BASE_URL)
    url.searchParams.set('serviceKey', apiKey)
    url.searchParams.set('pageNo', String(pageNo))
    url.searchParams.set('numOfRows', String(PAGE_SIZE))
    url.searchParams.set('type', 'json')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`API 호출 실패: ${res.status} ${res.statusText}`)

    const json: MfdsApiResponse = await res.json()
    const { header, body } = json

    if (header.resultCode !== '00') {
      throw new Error(`API 오류: ${header.resultCode} - ${header.resultMsg}`)
    }

    if (pageNo === 1) total = body.totalCount

    // 결과 없으면 종료
    if (!body.items || typeof body.items === 'string' || body.items.length === 0) break

    const items = body.items

    const upsertOps = items.map((raw) => {
      const data = mapBlockedIngredient(raw, syncedAt)
      return prisma.blockedIngredient.upsert({
        where: { rawIrdntNm: data.rawIrdntNm },
        create: data,
        update: data,
      })
    })
    await prisma.$transaction(upsertOps)
    upserted += items.length

    if (pageNo * PAGE_SIZE >= total) break
    pageNo++
  }

  return { upserted, total }
}
