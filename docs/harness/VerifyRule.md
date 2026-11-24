# VerifyRule — 검증 규칙

변경사항이 "통과했다"고 말할 수 있는 기준을 정한다.
기준은 하나다. **`npm run verify`가 exit 0으로 끝나야 한다.**

---

## 1. 검증 명령

```bash
npm run verify
```

여섯 단계를 순서대로 실행한다. 한 단계라도 실패하면 그 자리에서 멈추고 뒤 단계는 실행하지 않는다.

| 순서  | 단계           | 명령                       | 확인하는 것                             |
| --- | ------------ | ------------------------ | ---------------------------------- |
| 1   | Prepare      | `npm run verify:prepare` | 검증 전용 DB를 지우고 다시 만든다 (2절)          |
| 2   | Types        | `npm run typecheck`      | TypeScript 타입 에러 0                 |
| 3   | Lint         | `npm run lint`           | ESLint(`eslint-config-next`) 에러 0  |
| 4   | Architecture | `npm run check:arch`     | 재고 변경이 `applyMovement()`만 거친다 (3절) |
| 5   | Test         | `vitest run`             | `tests/`의 자동 테스트 전부 통과             |
| 6   | Build        | `npm run build`          | 프로덕션 빌드 성공                         |

단계를 하나만 따로 돌려도 되지만, 통과 판정은 `npm run verify` 전체 결과로만 한다.

---

## 2. 검증 환경 — 항상 같은 상태에서 시작한다

| 항목 | 규칙 |
|---|---|
| DB | 검증은 `prisma/verify.db`만 쓴다. 개발 DB(`prisma/dev.db`)는 건드리지 않는다 |
| 초기화 | Prepare가 매번 `verify.db`를 지우고 `prisma generate` → `migrate deploy` → 시드를 다시 실행한다 |
| 테스트 DB | `vitest.config.ts`가 `DATABASE_URL`을 `verify.db`로 고정한다. `npm test`를 단독으로 실행해도 Prepare를 먼저 거친다 |
| 시드 | 앱과 같은 `prisma/seed.ts`를 쓴다. 날짜는 실행일을 기준으로 계산하므로, 같은 날에는 같은 데이터가 만들어진다 |

---

## 3. Architecture Check

`docs/06-architecture.md` §4.1의 "`applyMovement()`는 재고 증감의 유일한 통로"를 기계로 검사한다.

| 항목 | 내용 |
|---|---|
| 검사 범위 | `src/` (`src/generated` 제외) |
| 허용 | `src/lib/stock.ts`. `Lot`의 읽기(`find*`, `aggregate`, `count`)는 어디서든 허용 |
| 실패 | `stock.ts` 밖에서 `.lot.create/createMany/update/updateMany/upsert/delete/deleteMany` 호출 |
| 실패 | `src/`에서 `$executeRaw`, `$executeRawUnsafe` 사용 (쓰기용 raw SQL은 우회 통로가 된다) |
| 범위 밖 | `prisma/seed.ts`의 초기화 코드 (앱 경로가 아니다) |

정규식으로 검사하므로 주석 안의 같은 문자열도 위반으로 잡힌다.

---

## 4. 실행 위치

| 위치                                              | 시점                 | 환경                                   |
| ----------------------------------------------- | ------------------ | ------------------------------------ |
| 로컬                                              | 변경을 끝냈다고 보고하기 전    | 로컬 Node                              |
| GitHub Actions (`.github/workflows/verify.yml`) | `main` push, 모든 PR | Node 24, `npm ci` 후 `npm run verify` |

CI는 `.env` 없이 돈다. `DATABASE_URL`은 `verify.db`로, `SESSION_SECRET`은 CI 전용 더미 값으로 워크플로에서 넣는다.

---

## 5. 판정과 보고

- **통과:** `npm run verify`가 exit 0. 이 결과 없이 "검증했다", "동작한다"고 보고하지 않는다.
- **실패:** 실패한 단계 이름과 에러 출력을 그대로 보고한다. 실패를 통과처럼 요약하지 않는다.
- **건너뜀:** 단계를 실행하지 못했으면 건너뛴 단계와 이유를 밝힌다.
- 변경과 무관한 기존 실패라도 실패는 실패다. 통과로 처리하지 않고 따로 알린다.

---

## 6. 검증 규칙을 바꾸는 방법

검증 스크립트는 [SSOT](SSOT.md) 4절의 "검증 스크립트" 영역이다. **AI는 실행만 하고, 정책 변경은 사람이 승인한다.**

대상 파일:

- `package.json`의 `verify`, `verify:prepare`, `check:arch`, `typecheck`, `test` 스크립트
- `scripts/prepare-verify-db.ts`, `scripts/check-architecture.ts`
- `vitest.config.ts`의 검증 DB 설정
- `.github/workflows/verify.yml`

AI는 검증을 통과시키려고 다음을 하지 않는다.

- 단계를 빼거나 순서를 바꾸기
- 검사 규칙을 느슨하게 하거나 허용 목록에 파일 추가하기
- 테스트를 건너뛰기(`skip`), 지우기, 기대값을 실패에 맞춰 바꾸기
- 린트 규칙 끄기, `eslint-disable` 주석 추가하기

이런 변경이 필요하다고 판단되면 **`NEEDS_HUMAN`** 상태를 선언하고 사람에게 판단을 요청한다.
