import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'

export interface Expense {
  id: string
  workspace_id: string
  spent_on: string
  amount: number
  category: string
  note: string | null
  deal_id: string | null
  receipt_path: string | null
  created_at: string
  updated_at: string
}

/**
 * The costs a creator actually has.
 *
 * Kept short on purpose. A long list invites the creator to hunt for the
 * perfect category instead of recording the number, and every one of these
 * maps to a line an accountant recognises.
 */
export const EXPENSE_CATEGORIES = [
  'Editing',
  'Camera & gear',
  'Team & salaries',
  'Travel',
  'Props & samples',
  'Software',
  'Other',
] as const

export async function getExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('spent_on', { ascending: false })

  if (error) throw error
  return (data ?? []) as Expense[]
}

export async function createExpense(input: {
  spent_on: string
  amount: number
  category: string
  note: string | null
  deal_id?: string | null
}): Promise<Expense> {
  const workspaceId = await getWorkspaceId()

  const { data, error } = await supabase
    .from('expenses')
    .insert({ workspace_id: workspaceId, ...input })
    .select()
    .single()

  if (error) throw error
  return data as Expense
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export interface ExpenseSummary {
  total: number
  byCategory: { category: string; total: number }[]
}

/**
 * Totals for a window, newest categories first.
 *
 * `from` and `to` are inclusive `YYYY-MM-DD`. String comparison is correct for
 * that format and avoids constructing a Date per row only to discard it.
 */
export function summarizeExpenses(
  expenses: readonly Expense[],
  from: string,
  to: string
): ExpenseSummary {
  const inWindow = expenses.filter((e) => e.spent_on >= from && e.spent_on <= to)

  const totals = new Map<string, number>()
  for (const expense of inWindow) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount)
  }

  return {
    total: inWindow.reduce((sum, e) => sum + e.amount, 0),
    byCategory: [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
  }
}
