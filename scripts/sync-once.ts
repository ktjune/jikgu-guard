/**
 * 식약처 차단 성분 데이터 1회 동기화 스크립트
 * 사용: npx tsx scripts/sync-once.ts
 */

import { fetchAndUpsertBlockedIngredients } from '../src/lib/mfds/sync'

async function main() {
  console.log('🔄 식약처 해외직구 차단 성분 데이터 동기화 시작...\n')

  const start = Date.now()
  const { upserted, total } = await fetchAndUpsertBlockedIngredients()
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`✅ 동기화 완료!`)
  console.log(`   총 ${total}건 중 ${upserted}건 처리 (${elapsed}초)`)
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ 동기화 실패:', err.message)
  process.exit(1)
})
