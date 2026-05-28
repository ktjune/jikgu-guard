import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  tokens: z
    .array(z.string().min(2).max(200))
    .min(1, '검색할 성분이 없습니다.')
    .max(300, '한 번에 최대 300개까지 검색 가능합니다.'),
})

// 성분명 하나에서 개별 명칭들을 추출 (쉼표·괄호 등으로 구분된 복수 명칭)
function splitNames(name: string | null): string[] {
  if (!name) return []
  return name
    .split(/[,;()\[\]\/]+/)
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length >= 3)
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0].message },
      { status: 400 },
    )
  }

  const { tokens } = parsed.data

  try {
    // 전체 차단 성분 목록을 가져와 메모리에서 매칭
    // (약 300건 수준이라 DB 순회보다 인메모리 비교가 정확하고 빠름)
    const [allIngredients, aggregate] = await Promise.all([
      prisma.blockedIngredient.findMany({
        select: {
          id: true,
          rawIrdntNm: true,
          rawIrdntEngNm: true,
          rawIrdntEtcNm: true,
          appnRelsDvs: true,
          appnDt: true,
          relsDt: true,
          appnRsn: true,
          relsRsn: true,
          syncedAt: true,
        },
      }),
      prisma.blockedIngredient.aggregate({ _max: { syncedAt: true } }),
    ])

    // 토큰 정규화
    const normalizedTokens = tokens.map((t) => t.toLowerCase().trim())

    // 각 차단 성분에 대해 토큰 매칭 검사
    const results = allIngredients.filter((ingredient) => {
      // 성분의 모든 명칭 variants 추출 (한글명, 영문명, 기타명)
      const names = [
        ...splitNames(ingredient.rawIrdntNm),
        ...splitNames(ingredient.rawIrdntEngNm),
        ...splitNames(ingredient.rawIrdntEtcNm),
      ]

      return normalizedTokens.some((token) =>
        names.some(
          (name) =>
            name === token ||                             // 정확히 일치
            (name.length >= 4 && token.includes(name)),  // 토큰이 성분명을 포함
          //  ↑ 예: token="Ephedrine HCl", name="ephedrine" → 감지
          //    예: token="acid" (4자), name="linolenic acid" → 감지 안 됨 (방향이 반대라 무관)
        ),
      )
    })

    // 차단 성분 우선, 이름순 정렬
    results.sort((a, b) => {
      if (a.appnRelsDvs !== b.appnRelsDvs) return a.appnRelsDvs ? -1 : 1
      return a.rawIrdntNm.localeCompare(b.rawIrdntNm, 'ko')
    })

    return NextResponse.json({
      ok: true,
      source: {
        name: '식약처 해외직구식품 국내 반입차단 대상 원료성분',
        url: 'https://www.mfds.go.kr',
        lastSyncedAt: aggregate._max.syncedAt?.toISOString() ?? null,
      },
      results,
      total: results.length,
    })
  } catch (error) {
    console.error('[POST /api/ingredients/batch-search] DB 조회 오류:', error)
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
