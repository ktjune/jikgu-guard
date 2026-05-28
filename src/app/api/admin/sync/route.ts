import { NextRequest, NextResponse } from 'next/server'
import { fetchAndUpsertBlockedIngredients } from '@/lib/mfds/sync'

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[admin/sync] CRON_SECRET 환경변수가 설정되지 않았습니다.')
    return false
  }
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token === secret
}

async function runSync() {
  const result = await fetchAndUpsertBlockedIngredients()
  return NextResponse.json({ ok: true, ...result })
}

// Vercel Cron은 GET 요청을 보냄
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 })
  }
  try {
    return await runSync()
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[admin/sync GET] 동기화 실패:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// 수동 트리거용 POST
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 })
  }
  try {
    return await runSync()
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[admin/sync POST] 동기화 실패:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
