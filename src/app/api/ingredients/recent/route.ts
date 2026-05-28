import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.blockedIngredient.findMany({
      where: { appnRelsDvs: true },
      select: {
        id: true,
        rawIrdntNm: true,
        rawIrdntEngNm: true,
        appnDt: true,
        appnRsn: true,
      },
      orderBy: { appnDt: 'desc' },
      take: 5,
    })

    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
