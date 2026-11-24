import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    // 개발 DB 대신 검증 전용 DB를 쓴다 (scripts/prepare-verify-db.ts 가 매번 새로 만든다)
    env: { DATABASE_URL: 'file:./prisma/verify.db' },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
