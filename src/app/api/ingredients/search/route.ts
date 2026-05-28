import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// 쿼리 파라미터 검증 스키마
const searchQuerySchema = z.object({
  q: z
    .string({ required_error: '검색어를 입력해주세요.' })
    .min(1, '검색어를 입력해주세요.')
    .max(100, '검색어는 100자 이내로 입력해주세요.'),
  status: z
    .enum(['all', 'blocked', 'released'])
    .optional()
    .default('all'),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // 입력 검증
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  })

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return NextResponse.json(
      { ok: false, error: firstError.message },
      { status: 400 },
    )
  }

  const { q, status } = parsed.data

  // status 필터 조건 구성
  const statusFilter =
    status === 'blocked'
      ? { appnRelsDvs: true }
      : status === 'released'
        ? { appnRelsDvs: false }
        : {}

  try {
    // 검색 및 최근 동기화 시각 병렬 조회
    const PAGE_LIMIT = 50

    const whereClause = {
      ...statusFilter,
      OR: [
        { rawIrdntNm: { contains: q, mode: 'insensitive' as const } },
        { rawIrdntEngNm: { contains: q, mode: 'insensitive' as const } },
        { rawIrdntEtcNm: { contains: q, mode: 'insensitive' as const } },
      ],
    }

    const [results, totalCount, aggregate] = await Promise.all([
      prisma.blockedIngredient.findMany({
        where: whereClause,
        take: PAGE_LIMIT,
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
        orderBy: [
          { appnRelsDvs: 'desc' },
          { rawIrdntNm: 'asc' },
        ],
      }),
      prisma.blockedIngredient.count({ where: whereClause }),
      prisma.blockedIngredient.aggregate({ _max: { syncedAt: true } }),
    ])

    const lastSyncedAt = aggregate._max.syncedAt?.toISOString() ?? null

    return NextResponse.json({
      ok: true,
      source: {
        name: '식약처 해외직구식품 국내 반입차단 대상 원료성분',
        url: 'https://www.mfds.go.kr',
        lastSyncedAt,
      },
      results,
      total: totalCount,
      hasMore: totalCount > PAGE_LIMIT,
    })
  } catch (error) {
    console.error('[GET /api/ingredients/search] DB 조회 오류:', {
      query: q,
      status,
      error,
    })
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
