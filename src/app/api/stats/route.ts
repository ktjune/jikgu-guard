import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [blockedCount, totalCount, aggregate] = await Promise.all([
      prisma.blockedIngredient.count({ where: { appnRelsDvs: true } }),
      prisma.blockedIngredient.count(),
      prisma.blockedIngredient.aggregate({ _max: { syncedAt: true } }),
    ])

    return NextResponse.json({
      ok: true,
      blockedCount,
      totalCount,
      lastSyncedAt: aggregate._max.syncedAt?.toISOString() ?? null,
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
