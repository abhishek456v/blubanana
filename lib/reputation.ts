import { supabase } from './supabase'
import type { BrandRating } from '@/types'

// Client reputation score (Phase 2). One review per deal, prompted once a
// deal reaches 'paid' — see the deal detail screen's "Rate this
// collaboration" card. RLS on brand_ratings restricts reads/writes to the
// authenticated user's own rows.

export interface SubmitRatingInput {
  deal_id: string
  brand_id: string
  rating: number // 1-5
  paid_on_time: boolean | null
  easy_to_work_with: boolean | null
  revision_rounds: number | null
  would_work_again: boolean | null
  notes: string | null
}

export async function submitRating(input: SubmitRatingInput): Promise<BrandRating> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('brand_ratings')
    .insert({ creator_id: user.id, ...input })
    .select()
    .single()
  if (error) throw error
  return data as BrandRating
}

export async function getRatingForDeal(dealId: string): Promise<BrandRating | null> {
  const { data, error } = await supabase
    .from('brand_ratings')
    .select('*')
    .eq('deal_id', dealId)
    .maybeSingle()
  if (error) throw error
  return data as BrandRating | null
}

// Fetches every rating for the creator in one round trip — used by the
// Brands list to show each row's score without an N+1 query per brand.
export async function getAllRatings(): Promise<BrandRating[]> {
  const { data, error } = await supabase
    .from('brand_ratings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as BrandRating[]
}

export async function getRatingsForBrand(brandId: string): Promise<BrandRating[]> {
  const { data, error } = await supabase
    .from('brand_ratings')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as BrandRating[]
}

export interface BrandReputationSummary {
  averageRating: number
  reviewCount: number
  lastPaidOnTime: boolean | null
}

// Powers the "you worked with them before" flag shown wherever a brand is
// picked for a new deal (deal/new.tsx) — the whole point of tracking this
// (product brief: "never work with a bad brand twice").
export function summarizeRatings(ratings: BrandRating[]): BrandReputationSummary | null {
  if (ratings.length === 0) return null
  const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
  return {
    averageRating,
    reviewCount: ratings.length,
    lastPaidOnTime: ratings[0].paid_on_time,
  }
}
