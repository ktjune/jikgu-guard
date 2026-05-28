import type { MfdsBlockedIngredientRaw } from './types'
import type { Prisma } from '@prisma/client'

// 빈 문자열 또는 null → null 정규화
function toNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  return value
}

// "YYYY-MM-DD" 문자열 → Date, 빈 문자열/null → null
function toDate(value: string | null | undefined): Date | null {
  if (!value || value === '') return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function mapBlockedIngredient(
  raw: MfdsBlockedIngredientRaw,
  syncedAt: Date,
): Prisma.BlockedIngredientUncheckedCreateInput {
  return {
    rawIrdntNm: raw.RAW_IRDNT_NM,
    rawIrdntEngNm: toNullable(raw.RAW_IRDNT_ENG_NM),
    rawIrdntEtcNm: toNullable(raw.RAW_IRDNT_ETC_NM),
    appnRelsDvs: raw.APPN_RELS_DVS === 'Y',
    appnDt: toDate(raw.APPN_DT),
    relsDt: toDate(raw.RELS_DT),
    appnRsn: toNullable(raw.APPN_RSN),
    relsRsn: toNullable(raw.RELS_RSN),
    syncedAt,
  }
}
