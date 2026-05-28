---
description: 현재 변경 사항에 대해 코드 리뷰만 실행
---

Invoke @reviewer directly. Skip other agents.

Reviewer should check:
1. 보안 (env 변수 노출, SQL injection, XSS)
2. 성능 (N+1 쿼리, 불필요한 리렌더)
3. 코드 품질 (TypeScript any, 미사용 import, 일관성)
4. 한국어 UX (오타, 어색한 표현)

Output: 우선순위별 (🔴 critical, 🟡 should-fix, 🔵 nice-to-have).
