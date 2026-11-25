/**
 * Issue #3 — 잔여 유통기한이 7일 미만인 재고의 출고 차단 (판정 테스트)
 *
 * 결정(NEEDS_HUMAN 응답, 1안): 배분 결과(FEFO 자동 또는 수동 선택)에 잔여 7일 미만 로트가
 * 하나라도 있으면 출고 요청 전체를 거부한다. 배분 로직은 그대로 둔다.
 *
 * 출고 기준일은 시스템 시각을 고정해 제어한다 — 실행 시점에 따라 결과가 바뀌지 않는다.
 * 기대 결과는 구현 함수를 쓰지 않고 "잔여 일수 >= 7이면 출고"라는 규칙으로 직접 정한다.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../helpers'
import { applyMovement } from '@/lib/stock'

// ── 서버 액션 밖의 Next.js 의존성만 대체한다 (로그인 세션, 캐시 무효화)
const session = vi.hoisted(() => ({ user: { id: 0, name: 'test' } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth')>()),
  requireUser: vi.fn(async () => session.user),
}))

import { saveOutbound } from '@/actions/outbound'

const SKU_PREFIX = 'TEST-ISSUE3-'
const DAY = 86_400_000

let baseDate: Date // 출고 기준일 (UTC 자정 날짜)
let ownId: number
let seq = 0

/** 기준일 + n일 (구현의 날짜 함수를 쓰지 않고 직접 계산) */
const expiryIn = (days: number) => new Date(baseDate.getTime() + days * DAY)

async function cleanup() {
  const products = await db.product.findMany({ where: { sku: { startsWith: SKU_PREFIX } } })
  const productIds = products.map((p) => p.id)
  await db.movement.deleteMany({ where: { productId: { in: productIds } } })
  await db.lot.deleteMany({ where: { productId: { in: productIds } } })
  await db.product.deleteMany({ where: { id: { in: productIds } } })
}

/** 테스트 전용 상품을 만들고, 잔여 일수별 로트를 자사창고에 입고한다 */
async function setupProduct(lots: { remainingDays: number; qty: number }[]) {
  seq += 1
  const product = await db.product.create({
    data: { sku: `${SKU_PREFIX}${Date.now()}-${seq}`, name: `이슈3 테스트 상품 ${seq}` },
  })
  for (const l of lots) {
    await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        productId: product.id,
        expiryDate: expiryIn(l.remainingDays),
        quantity: l.qty,
        toLocationId: ownId,
        userId: session.user.id,
      })
    )
  }
  return product
}

const stockOf = async (productId: number) =>
  (await db.lot.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity ?? 0

const outboundMovements = (productId: number) =>
  db.movement.findMany({ where: { productId, type: 'OUTBOUND' } })

const lotIdOf = async (productId: number, remainingDays: number) =>
  (
    await db.lot.findFirstOrThrow({
      where: { productId, locationId: ownId, expiryDate: expiryIn(remainingDays) },
    })
  ).id

describe('Issue #3 — 잔여 유통기한 7일 미만 출고 차단', () => {
  beforeAll(async () => {
    const now = new Date()
    // 실행 날짜의 정오로 시각을 고정 — 자정 경계에서 날짜가 바뀌어 흔들리지 않게 한다
    baseDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    ownId = (await db.location.findFirstOrThrow({ where: { type: 'OWN' } })).id
    session.user.id = (await db.user.findFirstOrThrow()).id
    await cleanup()
  })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(
      new Date(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 12)
    )
  })
  afterEach(() => vi.useRealTimers())
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  // 종료 조건 1
  it.each([
    { remainingDays: -3, label: '이미 지남' },
    { remainingDays: 0, label: '오늘까지' },
    { remainingDays: 6, label: '경계 바로 아래' },
  ])('잔여 유통기한 7일 미만($label, $remainingDays일)인 재고의 출고 요청은 거부된다', async ({ remainingDays }) => {
    const product = await setupProduct([{ remainingDays, qty: 10 }])
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 3 })
    expect(res.ok).toBe(false)
  })

  it('FEFO 배분에 7일 미만 로트가 섞이면 넉넉한 로트가 있어도 요청 전체가 거부된다 (1안)', async () => {
    const product = await setupProduct([
      { remainingDays: 3, qty: 2 },
      { remainingDays: 30, qty: 20 },
    ])
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 5 })
    expect(res.ok).toBe(false)
  })

  // 종료 조건 2
  it('잔여 유통기한이 정확히 7일인 재고는 정상 출고된다', async () => {
    const product = await setupProduct([{ remainingDays: 7, qty: 10 }])
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 3 })
    expect(res.ok).toBe(true)
    expect(await stockOf(product.id)).toBe(7)
  })

  // 종료 조건 3
  it.each([8, 30, 400])('잔여 유통기한이 7일을 넘는(%i일) 재고는 정상 출고된다', async (remainingDays) => {
    const product = await setupProduct([{ remainingDays, qty: 10 }])
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 4 })
    expect(res.ok).toBe(true)
    expect(await stockOf(product.id)).toBe(6)
  })

  // 종료 조건 4
  it('거부되면 사용자에게 잔여 유통기한 부족이라는 출고 불가 사유가 돌아간다', async () => {
    const product = await setupProduct([{ remainingDays: 2, qty: 10 }])
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 1 })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('유통기한')
    expect(res.error).toContain('7일')
    expect(res.error).toContain('출고할 수 없습니다')
  })

  // 종료 조건 5
  it('거부되면 요청 전후의 재고 수량이 같다', async () => {
    const product = await setupProduct([
      { remainingDays: -1, qty: 4 },
      { remainingDays: 60, qty: 9 },
    ])
    const before = await stockOf(product.id)
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 6 })
    expect(res.ok).toBe(false)
    expect(await stockOf(product.id)).toBe(before)
    expect(before).toBe(13)
  })

  // 종료 조건 6
  it('거부되면 출고 이력과 재고 차감 수불 이력이 생기지 않는다', async () => {
    const product = await setupProduct([
      { remainingDays: 5, qty: 4 },
      { remainingDays: 60, qty: 9 },
    ])
    const movementsBefore = await db.movement.count({ where: { productId: product.id } })
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SAMPLE', quantity: 6 })
    expect(res.ok).toBe(false)
    expect(await outboundMovements(product.id)).toHaveLength(0)
    expect(await db.movement.count({ where: { productId: product.id } })).toBe(movementsBefore)
  })

  // 종료 조건 7
  it('정상 출고되면 요청 수량만큼 재고가 차감되고 출고 이력이 FEFO 순서대로 남는다', async () => {
    const product = await setupProduct([
      { remainingDays: 10, qty: 3 },
      { remainingDays: 90, qty: 20 },
    ])
    const res = await saveOutbound({ productId: product.id, locationId: ownId, reason: 'SALE', quantity: 5 })
    expect(res.ok).toBe(true)
    expect(await stockOf(product.id)).toBe(23 - 5)

    const moves = await outboundMovements(product.id)
    expect(moves.map((m) => [m.expiryDate.getTime(), m.quantity]).sort((a, b) => a[0] - b[0])).toEqual([
      [expiryIn(10).getTime(), 3],
      [expiryIn(90).getTime(), 2],
    ])
    for (const m of moves) {
      expect(m.reason).toBe('SALE')
      expect(m.fromLocationId).toBe(ownId)
      expect(m.toLocationId).toBeNull()
      expect(m.userId).toBe(session.user.id)
    }
  })

  // 종료 조건 8
  it('화면을 거치지 않고 서버에 직접 수동 로트를 지정해 요청해도 같은 정책이 적용된다', async () => {
    const product = await setupProduct([
      { remainingDays: 1, qty: 5 },
      { remainingDays: 45, qty: 5 },
    ])
    const shortLot = await lotIdOf(product.id, 1)
    const okLot = await lotIdOf(product.id, 45)

    // 7일 미만 로트를 직접 지정 → 거부, 재고·이력 그대로
    const rejected = await saveOutbound({
      productId: product.id,
      locationId: ownId,
      reason: 'SALE',
      note: '직접 요청',
      quantity: 2,
      manual: [{ lotId: shortLot, qty: 2 }],
    })
    expect(rejected.ok).toBe(false)
    expect(await stockOf(product.id)).toBe(10)
    expect(await outboundMovements(product.id)).toHaveLength(0)

    // 7일 이상 로트를 직접 지정 → 기존처럼 출고
    const accepted = await saveOutbound({
      productId: product.id,
      locationId: ownId,
      reason: 'SALE',
      note: '직접 요청',
      quantity: 2,
      manual: [{ lotId: okLot, qty: 2 }],
    })
    expect(accepted.ok).toBe(true)
    expect(await stockOf(product.id)).toBe(8)
  })
})
