import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import { DEFAULT_STAGE_NAMES, type DealStage } from '@/types'

/**
 * A stage as the editor holds it, before it has been saved.
 *
 * `id` is absent for a stage the creator has just added. Everything else is
 * what the row will become.
 */
export interface StageDraft {
  id?: string
  name: string
  due_date: string | null
  done: boolean
}

export async function getStages(dealId: string): Promise<DealStage[]> {
  const { data, error } = await supabase
    .from('deal_stages')
    .select('*')
    .eq('deal_id', dealId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as DealStage[]
}

/** The stages a brand-new deal starts with, unsaved and undated. */
export function defaultStageDrafts(): StageDraft[] {
  return DEFAULT_STAGE_NAMES.map((name) => ({ name, due_date: null, done: false }))
}

/**
 * Replaces a deal's stages with exactly what the editor is holding.
 *
 * Delete-then-insert rather than a per-row diff. Stages are reorderable and
 * renameable, so a diff has to answer "is this the same stage renamed, or a
 * different stage in its place?" — a question the UI cannot answer either, and
 * getting it wrong silently moves a completed date onto the wrong stage.
 * Replacing sidesteps it entirely, and a deal has four or five stages, so the
 * cost is nothing.
 *
 * `done_at` is preserved for stages that survive by id, so re-saving a deal
 * does not erase when a stage was actually completed. A stage newly marked done
 * gets the current time; one newly un-done loses it, which is correct.
 */
export async function replaceStages(dealId: string, drafts: StageDraft[]): Promise<DealStage[]> {
  const workspaceId = await getWorkspaceId()

  // Read first, so completion times that already exist can be carried across.
  const existing = await getStages(dealId)
  const doneAtById = new Map(existing.map((stage) => [stage.id, stage.done_at]))

  const rows = drafts
    // A stage with no name is a row the creator started and abandoned. Saving
    // it would violate the name-not-blank constraint and fail the whole write.
    .filter((draft) => draft.name.trim().length > 0)
    .map((draft, index) => ({
      workspace_id: workspaceId,
      deal_id: dealId,
      name: draft.name.trim(),
      sort_order: index,
      due_date: draft.due_date,
      done: draft.done,
      done_at: draft.done
        ? (draft.id ? doneAtById.get(draft.id) : null) ?? new Date().toISOString()
        : null,
    }))

  const { error: deleteError } = await supabase
    .from('deal_stages')
    .delete()
    .eq('deal_id', dealId)
  if (deleteError) throw deleteError

  if (rows.length === 0) return []

  const { data, error } = await supabase.from('deal_stages').insert(rows).select()
  if (error) throw error
  return (data ?? []) as DealStage[]
}

/**
 * The stage a deal is currently working towards: the first not-done one.
 *
 * Null when every stage is done, which is what "the work is finished" looks
 * like — the deal is then waiting on money, not on her.
 */
export function currentStage(stages: readonly DealStage[]): DealStage | null {
  return stages.find((stage) => !stage.done) ?? null
}

/**
 * The next date this deal needs her attention, or null if nothing is dated.
 *
 * Only looks at stages that are still outstanding. A past date on a done stage
 * is history; a past date on a pending one is the thing that needs chasing,
 * and is deliberately still returned so the caller can show it as overdue.
 */
export function nextDueDate(stages: readonly DealStage[]): string | null {
  const dated = stages.filter((stage) => !stage.done && stage.due_date)
  if (dated.length === 0) return null
  return dated.reduce((earliest, stage) =>
    stage.due_date! < earliest.due_date! ? stage : earliest
  ).due_date
}
