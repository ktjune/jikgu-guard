import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// prisma 모킹: 실제 DB 연결 없이 단위 테스트 실행
vi.mock('@/lib/prisma', () => ({
  prisma: {
    blockedIngredient: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

// 모킹 후 라우트 핸들러 import (모킹 순서 보장)
import { GET } from './route'
import { prisma } from '@/lib/prisma'

// 타입 단언으로 mock 함수 접근 편의화
const mockFindMany = vi.mocked(prisma.blockedIngredient.findMany)
const mockAggregate = vi.mocked(prisma.blockedIngredient.aggregate)

// 샘플 DB 행
const sampleIngredient = {
  id: 1,
  rawIrdntNm: '디펜하이드라민',
  rawIrdntEngNm: 'Diphenhydramine',
  rawIrdntEtcNm: null,
  appnRelsDvs: true,
  appnDt: new Date('2024-04-29'),
  relsDt: null,
  appnRsn: '수입식품안전관리 특별법 제25조의3제1항',
  relsRsn: null,
  syncedAt: new Date('2026-05-18T00:00:00.000Z'),
}

const syncedAtDate = new Date('2026-05-18T00:00:00.000Z')

// 정상 케이스 기본 mock 설정 헬퍼
function setupDefaultMocks(rows = [sampleIngredient]) {
  mockFindMany.mockResolvedValue(rows as any)
  mockAggregate.mockResolvedValue({ _max: { syncedAt: syncedAtDate } } as any)
}

// URL로 NextRequest 생성 헬퍼
function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

// Response JSON 파싱 헬퍼
async function getJson(response: Response) {
  return response.json()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ingredients/search', () => {
  // ---------------------------------------------------------
  // 입력 검증 실패 케이스
  // ---------------------------------------------------------

  describe('입력 검증 오류 (400)', () => {
    it('q 파라미터 누락 → 400 + 검색어를 입력해주세요.', async () => {
      const req = makeRequest('http://localhost/api/ingredients/search')
      const res = await GET(req)

      expect(res.status).toBe(400)
      const body = await getJson(res)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('검색어를 입력해주세요.')
    })

    it('q 빈 문자열 → 400 + 검색어를 입력해주세요.', async () => {
      const req = makeRequest('http://localhost/api/ingredients/search?q=')
      const res = await GET(req)

      expect(res.status).toBe(400)
      const body = await getJson(res)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('검색어를 입력해주세요.')
    })

    it('q 길이 101자 초과 → 400', async () => {
      const longQuery = 'a'.repeat(101)
      const req = makeRequest(
        `http://localhost/api/ingredients/search?q=${longQuery}`,
      )
      const res = await GET(req)

      expect(res.status).toBe(400)
      const body = await getJson(res)
      expect(body.ok).toBe(false)
      expect(body.error).toBe('검색어는 100자 이내로 입력해주세요.')
    })
  })

  // ---------------------------------------------------------
  // 정상 응답 케이스 (200)
  // ---------------------------------------------------------

  describe('정상 검색 응답 (200)', () => {
    it('정상 검색 (q=디펜) → 200 + ok:true + source + results + total', async () => {
      setupDefaultMocks()
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜',
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await getJson(res)
      expect(body.ok).toBe(true)
      expect(body.source).toMatchObject({
        name: '식약처 해외직구식품 국내 반입차단 대상 원료성분',
        url: 'https://www.mfds.go.kr',
        lastSyncedAt: '2026-05-18T00:00:00.000Z',
      })
      expect(body.results).toHaveLength(1)
      expect(body.total).toBe(1)
    })

    it('빈 결과 → 200 + results:[] + total:0', async () => {
      setupDefaultMocks([])
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=없는성분',
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await getJson(res)
      expect(body.ok).toBe(true)
      expect(body.results).toEqual([])
      expect(body.total).toBe(0)
    })

    it('syncedAt이 null → lastSyncedAt:null 반환', async () => {
      mockFindMany.mockResolvedValue([])
      mockAggregate.mockResolvedValue({ _max: { syncedAt: null } } as any)

      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=테스트',
      )
      const res = await GET(req)
      const body = await getJson(res)

      expect(body.source.lastSyncedAt).toBeNull()
    })
  })

  // ---------------------------------------------------------
  // status 필터 전달 검증
  // ---------------------------------------------------------

  describe('status 필터 검증', () => {
    it('status=blocked → findMany에 appnRelsDvs:true 필터 전달', async () => {
      setupDefaultMocks()
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜&status=blocked',
      )
      await GET(req)

      expect(mockFindMany).toHaveBeenCalledOnce()
      const callArg = mockFindMany.mock.calls[0]?.[0]
      expect(callArg?.where).toMatchObject({ appnRelsDvs: true })
    })

    it('status=released → findMany에 appnRelsDvs:false 필터 전달', async () => {
      setupDefaultMocks()
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜&status=released',
      )
      await GET(req)

      expect(mockFindMany).toHaveBeenCalledOnce()
      const callArg = mockFindMany.mock.calls[0]?.[0]
      expect(callArg?.where).toMatchObject({ appnRelsDvs: false })
    })

    it('status=all (기본값) → findMany에 appnRelsDvs 필터 없음', async () => {
      setupDefaultMocks()
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜&status=all',
      )
      await GET(req)

      expect(mockFindMany).toHaveBeenCalledOnce()
      const callArg = mockFindMany.mock.calls[0]?.[0]
      // status=all 이면 statusFilter={}이므로 where에 appnRelsDvs 키 없음
      expect(callArg?.where).not.toHaveProperty('appnRelsDvs')
    })

    it('status 미전달 → 기본값 all 적용, appnRelsDvs 필터 없음', async () => {
      setupDefaultMocks()
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜',
      )
      await GET(req)

      const callArg = mockFindMany.mock.calls[0]?.[0]
      expect(callArg?.where).not.toHaveProperty('appnRelsDvs')
    })

    it('유효하지 않은 status 값 → 400', async () => {
      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜&status=invalid',
      )
      const res = await GET(req)

      expect(res.status).toBe(400)
      const body = await getJson(res)
      expect(body.ok).toBe(false)
    })
  })

  // ---------------------------------------------------------
  // DB 오류 케이스 (500)
  // ---------------------------------------------------------

  describe('DB 오류 (500)', () => {
    it('findMany에서 throw → 500 + 서버 오류 메시지', async () => {
      mockFindMany.mockRejectedValue(new Error('DB 연결 실패'))
      mockAggregate.mockResolvedValue({ _max: { syncedAt: null } } as any)

      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜',
      )
      const res = await GET(req)

      expect(res.status).toBe(500)
      const body = await getJson(res)
      expect(body.ok).toBe(false)
      expect(body.error).toBe(
        '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      )
    })

    it('aggregate에서 throw → 500 + 서버 오류 메시지', async () => {
      mockFindMany.mockResolvedValue([])
      mockAggregate.mockRejectedValue(new Error('aggregate 오류'))

      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=디펜',
      )
      const res = await GET(req)

      expect(res.status).toBe(500)
      const body = await getJson(res)
      expect(body.ok).toBe(false)
      expect(body.error).toBe(
        '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      )
    })
  })

  // ---------------------------------------------------------
  // 한국어 검색 시나리오 (요구사항 명시)
  // ---------------------------------------------------------

  describe('한국어 검색 시나리오', () => {
    it('"스테비아" 검색 → 안전(비차단) 성분 반환', async () => {
      const safeIngredient = {
        ...sampleIngredient,
        id: 2,
        rawIrdntNm: '스테비아',
        rawIrdntEngNm: 'Stevia',
        appnRelsDvs: false, // 차단 해제 = 안전
      }
      mockFindMany.mockResolvedValue([safeIngredient] as any)
      mockAggregate.mockResolvedValue({ _max: { syncedAt: syncedAtDate } } as any)

      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=스테비아',
      )
      const res = await GET(req)
      const body = await getJson(res)

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.results[0].appnRelsDvs).toBe(false)
      expect(body.results[0].rawIrdntNm).toBe('스테비아')
    })

    it('"DMAA" 검색 → 차단 성분 반환 + 위해성 정보(appnRsn) 포함', async () => {
      const dmaaIngredient = {
        ...sampleIngredient,
        id: 3,
        rawIrdntNm: '디메틸아밀아민',
        rawIrdntEngNm: 'DMAA',
        appnRelsDvs: true, // 차단 중
        appnRsn: '심혈관계 위해 우려 성분',
      }
      mockFindMany.mockResolvedValue([dmaaIngredient] as any)
      mockAggregate.mockResolvedValue({ _max: { syncedAt: syncedAtDate } } as any)

      const req = makeRequest(
        'http://localhost/api/ingredients/search?q=DMAA',
      )
      const res = await GET(req)
      const body = await getJson(res)

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.results[0].appnRelsDvs).toBe(true)
      expect(body.results[0].rawIrdntEngNm).toBe('DMAA')
      expect(body.results[0].appnRsn).toBeTruthy()
    })

    it('"팔미토일에탄올아미드" 검색 → 별칭(rawIrdntEtcNm) 매칭 포함 결과 반환', async () => {
      const peaIngredient = {
        ...sampleIngredient,
        id: 4,
        rawIrdntNm: '팔미토일에탄올아미드',
        rawIrdntEngNm: 'Palmitoylethanolamide',
        rawIrdntEtcNm: 'PEA', // 별칭
        appnRelsDvs: true,
      }
      mockFindMany.mockResolvedValue([peaIngredient] as any)
      mockAggregate.mockResolvedValue({ _max: { syncedAt: syncedAtDate } } as any)

      const req = makeRequest(
        `http://localhost/api/ingredients/search?q=${encodeURIComponent('팔미토일에탄올아미드')}`,
      )
      const res = await GET(req)
      const body = await getJson(res)

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.results[0].rawIrdntEtcNm).toBe('PEA')

      // OR 조건에 rawIrdntEtcNm 포함 여부 확인
      const whereClause = mockFindMany.mock.calls[0]?.[0]?.where
      const orConditions = (whereClause?.OR ?? []) as Array<Record<string, unknown>>
      const etcNmCondition = orConditions.find(
        (c) => 'rawIrdntEtcNm' in c,
      )
      expect(etcNmCondition).toBeDefined()
    })
  })
})
