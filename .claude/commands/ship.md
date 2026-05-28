---
description: 배포 준비 — 환경변수·빌드·마이그레이션 체크
---

Sequence:
1. @reviewer 실행 — 🔴 critical 있으면 STOP
2. @tester 실행 — 실패 있으면 STOP
3. `npm run build` 실행 — 에러 있으면 STOP
4. Prisma migration status 확인 — pending 있으면 사용자에게 보고
5. `.env.local.example` ↔ 실제 `.env.local` 동기화 확인
6. Vercel 배포 명령은 사용자가 직접 실행 — 우리는 체크리스트만 제공
