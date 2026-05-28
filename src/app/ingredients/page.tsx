import { prisma } from '@/lib/prisma'
import IngredientsClient, { type IngredientRow } from './_client'

export const metadata = {
  title: '차단 성분 목록 | 직구가드',
  description: '식약처 해외직구식품 국내 반입차단 대상 원료성분 전체 목록',
}

export default async function IngredientsPage() {
  const raw = await prisma.blockedIngredient.findMany({
    orderBy: [
      { appnRelsDvs: 'desc' }, // true(차단 중) 먼저
      { rawIrdntNm: 'asc' },
    ],
  })

  // Prisma Date → ISO string 변환
  const ingredients: IngredientRow[] = raw.map((item) => ({
    id: item.id,
    rawIrdntNm: item.rawIrdntNm,
    rawIrdntEngNm: item.rawIrdntEngNm ?? null,
    rawIrdntEtcNm: item.rawIrdntEtcNm ?? null,
    appnRelsDvs: item.appnRelsDvs,
    appnDt: item.appnDt ? item.appnDt.toISOString() : null,
    relsDt: item.relsDt ? item.relsDt.toISOString() : null,
    appnRsn: item.appnRsn ?? null,
    relsRsn: item.relsRsn ?? null,
    syncedAt: item.syncedAt.toISOString(),
  }))

  return <IngredientsClient ingredients={ingredients} />
}
