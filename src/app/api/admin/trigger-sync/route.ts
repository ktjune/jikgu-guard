import { NextResponse } from 'next/server'

// 관리자 전용 동기화 트리거 엔드포인트 (CRON_SECRET 인증 필요)
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET 미설정' }, { status: 500 })
  }

  // 호출자도 동일한 secret으로 인증
  const authHeader = request.headers.get('x-cron-secret')
  const bodySecret = await request.json().then((b: { secret?: string }) => b?.secret).catch(() => null)
  if (authHeader !== secret && bodySecret !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const res = await fetch(`${baseUrl}/api/cron/sync-blocked-products?secret=${secret}`, {
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
