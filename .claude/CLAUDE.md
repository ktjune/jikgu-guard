# Jikgu-Guard 프로젝트 가이드

## 프로젝트 개요

**제품**: 해외직구 영양제·다이어트약·식품의 위해성분을 즉시 체크해주는 B2C 웹 서비스
**핵심 가치**: 식약처가 공개한 "해외직구식품 국내 반입차단 대상 원료성분" 데이터를 일반 소비자가 라벨 사진 한 장 또는 성분명 검색으로 확인하게 함
**타겟 사용자**: 해외직구 영양제 구매자, 다이어트·헬스 인구, 부모 (자녀 영양제 체크)

## MVP 목표 (1~2주)

1. 식약처 차단 성분 DB 자동 수집·갱신
2. 텍스트 성분명 검색 → 차단/주의/안전 즉시 판정
3. 라벨 사진 업로드 → OCR로 성분 추출 → 자동 매칭
4. 결과 화면: 차단 성분 빨간색 강조 + 위해성 설명 + 식약처 출처 링크

## 스택

- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Backend: Next.js API Routes
- DB: Supabase (PostgreSQL) + Prisma ORM
- Auth: NextAuth (Phase 2)
- OCR: Tesseract.js (1차) → Google Cloud Vision API (2차, 필요 시)
- 데이터 수집: cron via Vercel Cron 또는 Supabase Edge Function
- 배포: Vercel

## 외부 API

- 식약처 공공데이터: data.mfds.go.kr 또는 공공데이터포털(data.go.kr)
- 키 데이터셋: "해외직구식품 국내 반입차단 대상 원료성분 서비스"
- 보조 데이터셋: "해외위해정보 서비스", "해외직구 위해식품 차단정보", "해외 위해식품 회수정보"

## 빌드 원칙

1. **단순함 우선**: 첫 MVP는 화려함 ❌, 작동함 ✅
2. **한국어 UX**: 모든 라벨·에러 메시지·placeholder는 한국어
3. **공공데이터 출처 명시**: 모든 차단 성분 표시 옆에 "출처: 식약처 (날짜)" 표시
4. **법적 면책**: 푸터에 "본 서비스는 식약처 공공데이터 기반 참고용이며, 의학적 자문이 아닙니다" 명시

## 코딩 컨벤션

- 파일·폴더: kebab-case
- 컴포넌트: PascalCase
- 함수·변수: camelCase
- 환경변수: SCREAMING_SNAKE_CASE
- 한국어 주석 OK, 영어도 OK, 혼용 OK

## 금지 사항

- 인증 없이 사용자 입력을 그대로 DB에 저장
- 외부 API 키를 클라이언트 측 코드에 포함
- 식약처 데이터를 임의로 가공해서 "안전" 판정 (출처 그대로 표시)
- 의학적 진단·치료 추천 (참고용 정보만)
