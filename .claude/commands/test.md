---
description: 현재 변경 사항에 대해 테스트만 실행
---

Invoke @tester directly. Skip planner and other agents.

Tester should:
1. Identify what changed (git diff)
2. Run relevant unit tests
3. Run relevant E2E tests if UI changed
4. Report pass/fail with file:line for failures
