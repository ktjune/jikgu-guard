import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '직구가드 | 해외직구 영양제 성분 안전 체크',
  description:
    '해외직구 영양제·다이어트약의 위해성분을 즉시 체크하세요. 식약처 공공데이터 기반.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 flex flex-col text-gray-900 antialiased">
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
          <nav className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-6">
            <a
              href="/"
              className="text-base font-bold text-indigo-600 hover:text-indigo-700 shrink-0"
            >
              🛡️ 직구가드
            </a>
            <div className="flex items-center gap-4 overflow-x-auto">
              <a
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-indigo-600 whitespace-nowrap"
              >
                🔍 성분 검색
              </a>
              <a
                href="/ingredients"
                className="text-sm font-medium text-gray-600 hover:text-indigo-600 whitespace-nowrap"
              >
                📋 차단 성분 목록
              </a>
              <a
                href="/blocked-products"
                className="text-sm font-medium text-gray-600 hover:text-indigo-600 whitespace-nowrap"
              >
                ⚠️ 위해 제품
              </a>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-auto border-t border-gray-200 bg-white py-6 px-4">
          <div className="mx-auto max-w-4xl text-center space-y-1">
            <p className="text-sm text-gray-500">
              본 서비스는 식약처 공공데이터 기반 참고용이며, 의학적 자문이 아닙니다.
            </p>
            <p className="text-xs text-gray-400">
              출처: 식약처(MFDS) 공공데이터포털
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
