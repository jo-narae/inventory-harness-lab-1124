import { daysUntil } from './date'
import { DEFAULT_EXPIRY_ALERT_DAYS } from './constants'

export type ExpiryStatus = 'EXPIRED' | 'SOON' | 'OK'

/**
 * 유통기한 상태 판정.
 * 경고 기준일은 상품마다 다르다 (F1).
 */
export function expiryStatus(expiryDate: Date, alertDays = DEFAULT_EXPIRY_ALERT_DAYS): ExpiryStatus {
  const d = daysUntil(expiryDate)
  if (d < 0) return 'EXPIRED'
  if (d <= alertDays) return 'SOON'
  return 'OK'
}

export const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  EXPIRED: '만료',
  SOON: '임박',
  OK: '정상',
}

/** 색만으로 구분하지 않는다 — 배지 글자를 함께 쓴다 (접근성) */
export const EXPIRY_CLASS: Record<ExpiryStatus, string> = {
  EXPIRED: 'bg-red-bg text-red',
  SOON: 'bg-amber-bg text-amber',
  OK: 'bg-ok-bg text-ok',
}

/** 출고에 필요한 최소 잔여 유통기한 (Issue #3). 이 일수 미만이면 출고하지 않는다 */
export const MIN_OUTBOUND_REMAINING_DAYS = 7

/** 출고 기준일(서버의 오늘)에 이 로트를 출고할 수 있는가 */
export function canOutboundByExpiry(expiryDate: Date): boolean {
  return daysUntil(expiryDate) >= MIN_OUTBOUND_REMAINING_DAYS
}
