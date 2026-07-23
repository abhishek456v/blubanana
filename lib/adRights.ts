import type { Deal } from '@/types'
import { scheduleAsync, cancelAsync } from './notifications'

// Ad rights tracking: an optional add-on term where the brand pays extra for
// the right to reuse the creator's content in paid ads for a fixed window.
// Not part of PRODUCT.md's original Phase 1 scope — added on top of it per
// the prototype/feature-brief materials, kept as simple as those describe:
// manual entry + a 30-day-before-expiry nudge + a one-tap Meta Ad Library
// search link. No Meta API integration (that's the brief's Phase 3 version).

const DEFAULT_REMINDER_HOUR = 9
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function dateAtHour(dateStr: string, hour: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, hour, 0, 0, 0)
}

// Adds calendar months to a YYYY-MM-DD start date. Mirrors the day-of-month
// where possible; JS Date rolls into the following month when the start day
// doesn't exist there (e.g. Jan 31 + 1 month → Mar 3), same behavior already
// relied on elsewhere in this codebase (lib/deals.ts calculateDueDate).
export function calculateAdRightsExpiry(
  startDate: string | null,
  durationMonths: number | null
): string | null {
  if (!startDate || !durationMonths) return null
  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(year, month - 1 + durationMonths, day)
  return date.toISOString().split('T')[0]
}

export interface AdRightsReminderFields {
  ad_rights_reminder_notification_id: string | null
}

// Called whenever ad rights fields change — cancels whatever was previously
// scheduled and reschedules a single one-shot reminder 30 days before
// expiry. Unlike workflow reminders (lib/reminders.ts) there's no chain of
// stages here, so one fixed nudge is enough.
export async function rescheduleAdRightsReminder(
  deal: Pick<
    Deal,
    'id' | 'brand' | 'ad_rights_granted' | 'ad_rights_expires_date' | 'ad_rights_reminder_notification_id'
  >
): Promise<AdRightsReminderFields> {
  await cancelAsync(deal.ad_rights_reminder_notification_id)

  if (!deal.ad_rights_granted || !deal.ad_rights_expires_date) {
    return { ad_rights_reminder_notification_id: null }
  }

  const brandName = deal.brand?.name ?? 'Brand'
  const expiresAt = dateAtHour(deal.ad_rights_expires_date, DEFAULT_REMINDER_HOUR)
  const remindAt = new Date(expiresAt.getTime() - THIRTY_DAYS_MS)

  if (remindAt.getTime() <= Date.now()) {
    return { ad_rights_reminder_notification_id: null }
  }

  const id = await scheduleAsync(
    {
      title: 'Ad rights expiring soon',
      body: `${brandName}'s ad rights expire in 30 days — worth checking if they're still running the ad.`,
      data: { type: 'ad_rights_expiring', dealId: deal.id },
    },
    remindAt
  )
  return { ad_rights_reminder_notification_id: id }
}

export async function cancelAdRightsReminder(
  deal: Pick<Deal, 'ad_rights_reminder_notification_id'>
): Promise<AdRightsReminderFields> {
  await cancelAsync(deal.ad_rights_reminder_notification_id)
  return { ad_rights_reminder_notification_id: null }
}

export type AdRightsStatus = 'active' | 'expiring_soon' | 'expired'

// 'expiring_soon' uses the same 30-day window as the reminder threshold.
export function getAdRightsStatus(
  deal: Pick<Deal, 'ad_rights_granted' | 'ad_rights_expires_date'>
): AdRightsStatus | null {
  if (!deal.ad_rights_granted || !deal.ad_rights_expires_date) return null

  const [year, month, day] = deal.ad_rights_expires_date.split('-').map(Number)
  const expires = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntilExpiry = Math.round((expires.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'expiring_soon'
  return 'active'
}

// Meta's public Ad Library search page doesn't require an API token to view
// (only the JSON API does) — this just deep-links to a pre-filled search for
// the brand, so the creator doesn't have to navigate and type it in by hand.
// This is the "Phase 2-lite" version from the feature brief; automatic
// monitoring via the real Ad Library API is a later, separate decision.
export function buildMetaAdLibraryUrl(brandName: string): string {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: 'IN',
    q: brandName,
    search_type: 'keyword_unordered',
    media_type: 'all',
  })
  return `https://www.facebook.com/ads/library/?${params.toString()}`
}
