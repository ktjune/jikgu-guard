# Jikgu-Guard 직구가드

해외직구 영양제·다이어트약·식품의 위해성분을 즉시 체크해주는 B2C 웹 서비스.

식약처가 공개한 "해외직구식품 국내 반입차단 대상 원료성분" 데이터를 기반으로,  
라벨 사진 한 장 또는 성분명 검색으로 위해 여부를 즉시 확인합니다.

## 시작하기

### 환경변수 설정

```bash
cp .env.local.example .env.local
# .env.local 파일을 열어 필요한 값 입력
```

### 의존성 설치

```bash
npm install
```

### Prisma 클라이언트 생성

```bash
npx prisma generate
```

### 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인.

## 주요 기능

- **성분명 검색**: 텍스트로 성분명 입력 → 차단/주의/안전 즉시 판정
- **라벨 사진 OCR**: 사진 업로드 → 성분 자동 추출 → 위해성 매칭
- **식약처 출처 명시**: 모든 판정 결과에 식약처 공공데이터 출처 및 날짜 표시

## 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- **Backend**: Next.js API Routes
- **DB**: Supabase (PostgreSQL) + Prisma ORM
- **OCR**: Tesseract.js
- **배포**: Vercel

## 법적 면책

본 서비스는 식약처 공공데이터 기반 참고용이며, 의학적 자문이 아닙니다.  
최종 판단은 반드시 전문가 또는 식약처 공식 채널을 통해 확인하세요.

## 데이터 출처

- [식약처 공공데이터](https://data.mfds.go.kr)
- [공공데이터포털](https://data.go.kr) — "해외직구식품 국내 반입차단 대상 원료성분 서비스"
