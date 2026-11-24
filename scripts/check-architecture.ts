/**
 * Architecture Check (npm run verify 의 Lint 다음 단계).
 *
 * 규칙 — docs/06-architecture.md §2, §4.1
 *   재고 수량(Lot)을 바꾸는 코드는 src/lib/stock.ts 의 applyMovement() 한 곳에만 존재한다.
 *   화면·액션·도메인 로직은 이 함수를 부를 뿐, lot 쓰기를 직접 호출하지 않는다.
 *
 * 검사 대상: src/ (src/generated 제외). prisma/seed.ts 의 초기화 코드는 앱 경로가 아니므로 대상이 아니다.
 * 위반이 하나라도 있으면 exit 1.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const ALLOWED = new Set(['src/lib/stock.ts'])
const IGNORED_DIRS = new Set([path.join(SRC, 'generated')])

const RULES: { pattern: RegExp; message: string }[] = [
  {
    // tx.lot.update(...), db.lot\n  .upsert(...) 등. 읽기(find*, aggregate, count)는 허용
    pattern: /\.lot\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g,
    message: 'Lot을 직접 변경했습니다. 재고 변경은 applyMovement()를 거쳐야 합니다',
  },
  {
    // raw SQL 은 '복잡한 조회'에만 허용된다 (06 §7.5). 쓰기용 raw SQL 은 Lot 우회 통로가 된다
    pattern: /\$executeRaw(Unsafe)?\b/g,
    message: '쓰기용 raw SQL은 applyMovement()를 우회합니다',
  },
]

function walk(dir: string): string[] {
  if (IGNORED_DIRS.has(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(e.name) ? [full] : []
  })
}

const violations: string[] = []

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/')
  if (ALLOWED.has(rel)) continue
  const text = readFileSync(file, 'utf8')
  for (const { pattern, message } of RULES) {
    for (const m of text.matchAll(pattern)) {
      const line = text.slice(0, m.index).split('\n').length
      violations.push(`  ${rel}:${line}  ${m[0].replace(/\s+/g, '')}  — ${message}`)
    }
  }
}

if (violations.length > 0) {
  console.error(`\n✖ Architecture Check 실패 (${violations.length}건)\n`)
  console.error(violations.join('\n'))
  console.error('\n  규칙: docs/06-architecture.md §4.1 — applyMovement()는 재고 증감의 유일한 통로\n')
  process.exit(1)
}

console.log('✓ Architecture Check 통과 — 재고 변경은 applyMovement()만 거칩니다')
