import { describe, it, expect } from 'vitest'
import { mapBlockedIngredient } from './mappers'
import type { MfdsBlockedIngredientRaw } from './types'

const syncedAt = new Date('2026-05-18T00:00:00.000Z')

const baseRaw: MfdsBlockedIngredientRaw = {
  APPN_RELS_DVS: 'Y',
  RAW_IRDNT_NM: '디펜하이드라민',
  RAW_IRDNT_ENG_NM: 'Diphenhydramine',
  RAW_IRDNT_ETC_NM: '',
  APPN_DT: '2024-04-29',
  RELS_DT: '',
  APPN_RSN: '「수입식품안전관리 특별법」 제25조의3제1항',
  RELS_RSN: '',
}

describe('mapBlockedIngredient', () => {
  it('한글 성분명을 정확히 매핑한다', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.rawIrdntNm).toBe('디펜하이드라민')
  })

  it('영문 성분명을 정확히 매핑한다', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.rawIrdntEngNm).toBe('Diphenhydramine')
  })

  it('APPN_RELS_DVS="Y" → appnRelsDvs=true', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.appnRelsDvs).toBe(true)
  })

  it('APPN_RELS_DVS="N" → appnRelsDvs=false', () => {
    const result = mapBlockedIngredient({ ...baseRaw, APPN_RELS_DVS: 'N' }, syncedAt)
    expect(result.appnRelsDvs).toBe(false)
  })

  it('날짜 문자열 "YYYY-MM-DD" → Date 변환', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.appnDt).toBeInstanceOf(Date)
    expect((result.appnDt as Date).getFullYear()).toBe(2024)
  })

  it('빈 문자열 날짜 → null', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.relsDt).toBeNull()
  })

  it('빈 문자열 텍스트 필드 → null 정규화', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.rawIrdntEtcNm).toBeNull()
    expect(result.relsRsn).toBeNull()
  })

  it('syncedAt을 그대로 유지한다', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.syncedAt).toBe(syncedAt)
  })

  it('지정사유가 있을 때 정확히 매핑한다', () => {
    const result = mapBlockedIngredient(baseRaw, syncedAt)
    expect(result.appnRsn).toContain('수입식품안전관리 특별법')
  })
})
