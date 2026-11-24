/**
 * 검증용 DB 준비 (npm run verify 의 Prepare 단계).
 *
 * 개발 DB(prisma/dev.db)와 분리된 prisma/verify.db 를 매번 지우고
 * 마이그레이션 → 시드를 처음부터 다시 실행한다.
 * 그래서 테스트는 로컬에서 무엇을 만지고 있었든 항상 같은 시드 상태에서 시작한다.
 */
import { rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const VERIFY_DB_URL = 'file:./prisma/verify.db'

const dbPath = path.resolve(process.cwd(), 'prisma/verify.db')
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  rmSync(dbPath + suffix, { force: true })
}

const env = { ...process.env, DATABASE_URL: VERIFY_DB_URL }
const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', env })

console.log('\n▸ 검증용 DB를 새로 만듭니다 (prisma/verify.db)\n')
run('npx prisma migrate deploy')
run('npx tsx prisma/seed.ts')
console.log('\n▸ 검증용 DB 준비 완료\n')
