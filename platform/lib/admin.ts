import { supabase } from './supabase'

/**
 * The admin dashboard's data layer.
 *
 * Everything goes through one edge function. Not because one function is
 * tidier, but because the alternative is a browser holding a key that can read
 * every creator's business, which would undo all of the tenancy work in a
 * single line of configuration.
 *
 * The function re-checks the caller's role on the server every time. Nothing
 * here is trusted, and nothing here needs to be.
 */
async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin', {
    body: { action, ...extra },
  })
  if (error) throw error
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return data as T
}

export interface AdminOverview {
  workspaces: number
  deals: number
  invoices: number
  subscriptions: Record<string, number>
}

export interface AdminHealth {
  socialAccounts: {
    platform: string
    handle: string
    status: string
    last_error: string | null
    workspace_id: string
  }[]
  missedReminders: {
    id: string
    type: string
    status: string
    scheduled_for: string
    workspace_id: string
  }[]
  stuckMessages: {
    id: string
    channel: string
    purpose: string
    status: string
    created_at: string
    workspace_id: string
  }[]
}

export interface AdminFunnel {
  total: number
  withBrand: number
  withDeal: number
  withInvoice: number
  rows: {
    id: string
    name: string
    created_at: string
    brand: boolean
    deal: boolean
    invoice: boolean
  }[]
}

export const getAdminOverview = () => call<AdminOverview>('overview')
export const getAdminHealth = () => call<AdminHealth>('health')
export const getAdminFunnel = () => call<AdminFunnel>('funnel')

/** Everything the health screen counts as needing attention, in one number. */
export function healthIssueCount(health: AdminHealth): number {
  return health.socialAccounts.length + health.missedReminders.length + health.stuckMessages.length
}


export interface Announcement {
  id: string
  kind: 'news' | 'banner' | 'alert'
  /** bar: a line in the top strip. popup: a card over the page. image: a picture. */
  placement: 'bar' | 'popup' | 'image'
  image_url: string | null
  sort_order: number
  title: string
  body: string | null
  surface: 'app' | 'website' | 'both'
  audience: 'everyone' | 'trialing' | 'paying' | 'lapsed'
  link_url: string | null
  link_label: string | null
  dismissible: boolean
  starts_at: string
  ends_at: string | null
  published: boolean
  created_at: string
}

/** Everything, drafts included. The public policy only exposes live ones. */
export const listAnnouncements = () =>
  call<{ rows: Announcement[] }>('announcements.list').then((r) => r.rows)

export const saveAnnouncement = (announcement: Partial<Announcement>) =>
  call<{ row: Announcement }>('announcements.save', { announcement }).then((r) => r.row)

export const deleteAnnouncement = (id: string) =>
  call<{ ok: true }>('announcements.delete', { id })

/** Whether an announcement is on screen right now, for the admin list. */
export function isLive(a: Announcement, now = new Date()): boolean {
  if (!a.published) return false
  if (new Date(a.starts_at) > now) return false
  return !a.ends_at || new Date(a.ends_at) > now
}
