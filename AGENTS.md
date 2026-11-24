# AGENTS.md

재고관리 PoC. 어떤 문서가 원본인지는 [`docs/harness/SSOT.md`](docs/harness/SSOT.md)가 정한다.

## 읽는 순서

1. **작업을 시작할 때 문서를 한꺼번에 읽지 않는다.** 질문의 종류를 아래 표에서 고르고, 그 원본만 읽는다.
2. 원본도 통째로 읽지 않는다. 제목(`#`, `##`)으로 관련 절을 찾아 그 절만 읽는다.
3. 라우팅된 원본으로 판단할 수 없을 때만 범위를 넓힌다 (아래 "범위 넓히기").

## 라우팅

| 질문의 종류 | 읽을 원본 |
|---|---|
| 재고 업무 규칙, 용어, 사유 체계, 기능 범위, 범위 제외, 완료 기준 | `docs/01-requirements.md` |
| 폴더 구조, 데이터 모델, 핵심 로직(재고 변경·배분·정산), 상태 흐름, 인증, 시드, 아키텍처 결정 | `docs/06-architecture.md` |
| 특정 작업의 목적·범위·완료 조건 | 해당 GitHub Issue — `gh issue view <번호> --repo jo-narae/inventory-harness-lab-1124` |
| Next.js 16 API·규약 | `node_modules/next/dist/docs/` (아래 관리 블록 참고) |
| 어느 문서가 원본인지 | `docs/harness/SSOT.md` |
| 검증 규칙, 구현·검증 루프 | **아직 없다.** 추측해서 만들지 말고 없다고 알린다 |

질문이 두 종류에 걸치면 해당하는 원본을 각각 읽는다. 그 외의 원본은 읽지 않는다.

## 범위 넓히기

라우팅된 원본에 답이 없거나 모호할 때만, 아래 순서로 한 단계씩 넓힌다. 답을 찾으면 멈춘다.

1. 같은 원본의 인접 절
2. 원본이 가리키는 코드 (`src/`, `prisma/schema.prisma`, `tests/`)
3. `docs/` 안의 다른 문서
4. 그래도 판단할 수 없으면 사용자에게 묻는다

범위를 넓혔다면 무엇을 왜 더 읽었는지 답변에 짧게 남긴다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
