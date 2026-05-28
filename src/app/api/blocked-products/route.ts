import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

const PAGE_SIZE = 100

export interface BlockedProduct {
  id: string
  prdlstNm: string
  cmpnyNm: string | null
  hrmflNm: string | null
  ntcnDt: string | null   // ISO string
  ctryNm: string | null
  imageUrl: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const q = searchParams.get('q')?.trim() ?? ''

  const where = q
    ? {
        OR: [
          { prdlstNm: { contains: q, mode: 'insensitive' as const } },
          { hrmflNm:  { contains: q, mode: 'insensitive' as const } },
          { cmpnyNm:  { contains: q, mode: 'insensitive' as const } },
          { ctryNm:   { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, rows] = await Promise.all([
    prisma.blockedProduct.count({ where }),
    prisma.blockedProduct.findMany({
      where,
      orderBy: { ntcnDt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const products: BlockedProduct[] = rows.map((r) => ({
    id:       r.id,
    prdlstNm: r.prdlstNm,
    cmpnyNm:  r.cmpnyNm  ?? null,
    hrmflNm:  r.hrmflNm  ?? null,
    ntcnDt:   r.ntcnDt   ? r.ntcnDt.toISOString() : null,
    ctryNm:   r.ctryNm   ?? null,
    imageUrl: r.imageUrl ?? null,
  }))

  return NextResponse.json({
    ok: true,
    products,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  })
}
