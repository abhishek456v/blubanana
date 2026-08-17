import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import {
  EXPENSE_CATEGORIES,
  createExpense,
  deleteExpense,
  getExpenses,
  summarizeExpenses,
  type Expense,
} from '@/lib/expenses'
import { formatCurrency, formatDate, toDateString } from '@/lib/format'
import { ContentMaxWidth, FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  Chip,
  DateField,
  EmptyState,
  Figure,
  PressableScale,
  RevealScrollView,
  Skeleton,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'

/**
 * What the work cost.
 *
 * This is what turns "turnover" into "taxable income", and it is the half of
 * the annual report that was missing: a creator who bills ₹14L and pays an
 * editor ₹3L of it is not taxed on ₹14L, but the report said so.
 *
 * Deliberately not tied to deals. Most creator costs are not attributable to
 * one collaboration — a camera, a monthly editor retainer, travel to a shoot
 * that covered three brands — and forcing a deal would either block the entry
 * or invite a wrong one.
 */
export default function ExpensesScreen() {
  const { c } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [note, setNote] = useState('')
  const [spentOn, setSpentOn] = useState<string | null>(toDateString(new Date()))

  const load = useCallback(async () => {
    try {
      setExpenses(await getExpenses())
    } catch {
      toast('Could not load your expenses', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  // The Indian financial year, April to March, because that is the window the
  // creator's tax return covers and therefore the only one worth totalling.
  const fy = useMemo(() => {
    const now = new Date()
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    return {
      from: `${startYear}-04-01`,
      to: `${startYear + 1}-03-31`,
      label: `FY ${startYear}–${String(startYear + 1).slice(2)}`,
    }
  }, [])

  const summary = useMemo(
    () => summarizeExpenses(expenses, fy.from, fy.to),
    [expenses, fy]
  )

  const reset = () => {
    setAdding(false)
    setAmount('')
    setCategory(EXPENSE_CATEGORIES[0])
    setNote('')
    setSpentOn(toDateString(new Date()))
  }

  async function handleAdd() {
    const value = Number(amount.replace(/[^0-9]/g, '')) || 0
    if (value <= 0) {
      toast('Enter what it cost', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      const created = await createExpense({
        spent_on: spentOn ?? toDateString(new Date()),
        amount: value,
        category,
        note: note.trim() || null,
      })
      setExpenses((prev) => [created, ...prev])
      reset()
    } catch {
      toast('Could not save that expense', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(expense: Expense) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: `${formatCurrency(expense.amount)} · ${expense.category}`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return

    try {
      await deleteExpense(expense.id)
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
    } catch {
      toast('Could not delete that expense', { tone: 'error' })
    }
  }

  return (
    <ModalSheet title="Expenses">
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <Skeleton height={120} radius={Radius.lg} />
          ) : (
            <>
              <View style={[styles.totalCard, { backgroundColor: c.bgSurface }]}>
                <Text style={[styles.totalLabel, { color: c.textSecondary }]}>
                  Spent in {fy.label}
                </Text>
                <Figure
                  value={formatCurrency(summary.total)}
                  size="hero"
                  color={c.textPrimary}
                  bold
                />
                <Text style={[styles.totalHint, { color: c.textMuted }]}>
                  Deducted from your income in Year in review, so the figure there is
                  what you are actually taxed on.
                </Text>
              </View>

              {summary.byCategory.length > 0 ? (
                <View style={styles.breakdown}>
                  {summary.byCategory.map((row) => (
                    <View key={row.category} style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: c.textSecondary }]}>
                        {row.category}
                      </Text>
                      <Figure value={formatCurrency(row.total)} size="sm" color={c.textPrimary} />
                    </View>
                  ))}
                </View>
              ) : null}

              {adding ? (
                <Animated.View
                  entering={FadeIn.duration(Duration.fast)}
                  style={[styles.form, { backgroundColor: c.bgSurface }]}
                >
                  <TextField
                    label="Amount"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="number-pad"
                    placeholder="0"
                  />

                  <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Category</Text>
                  <View style={styles.categoryRow}>
                    {EXPENSE_CATEGORIES.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        selected={category === option}
                        onPress={() => setCategory(option)}
                      />
                    ))}
                  </View>

                  <DateField label="When" value={spentOn} onChange={setSpentOn} />
                  <TextField
                    label="Note"
                    value={note}
                    onChangeText={setNote}
                    placeholder="What it was for"
                  />

                  <Button
                    label={saving ? 'Saving…' : 'Add expense'}
                    onPress={handleAdd}
                    disabled={saving}
                    fullWidth
                  />
                  <Button label="Cancel" variant="ghost" onPress={reset} fullWidth />
                </Animated.View>
              ) : (
                <PressableScale
                  onPress={() => setAdding(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add an expense"
                  style={[styles.add, { borderColor: c.borderStrong }]}
                >
                  <Ionicons name="add" size={17} color={c.accent} />
                  <Text style={[styles.addText, { color: c.accentText }]}>Add expense</Text>
                </PressableScale>
              )}

              {expenses.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="Nothing logged yet"
                  message="Editor fees, gear, travel, software. Anything you spend to make the work is deductible, and it is the difference between what you billed and what you are taxed on."
                />
              ) : (
                <View style={styles.list}>
                  {expenses.map((expense) => (
                    <Animated.View
                      key={expense.id}
                      entering={FadeIn.duration(Duration.fast)}
                      exiting={FadeOut.duration(Duration.fast)}
                      layout={Layout.duration(Duration.base)}
                      style={[styles.row, { borderColor: c.border }]}
                    >
                      <View style={styles.rowText}>
                        <Text style={[styles.rowCategory, { color: c.textPrimary }]}>
                          {expense.category}
                        </Text>
                        <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                          {[formatDate(expense.spent_on), expense.note].filter(Boolean).join(' · ')}
                        </Text>
                      </View>

                      <Figure
                        value={formatCurrency(expense.amount)}
                        size="sm"
                        color={c.textPrimary}
                      />

                      <PressableScale
                        onPress={() => handleDelete(expense)}
                        hitSlop={HitSlop}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${expense.category} expense`}
                      >
                        <Ionicons name="close" size={17} color={c.textMuted} />
                      </PressableScale>
                    </Animated.View>
                  ))}
                </View>
              )}
            </>
          )}
        </RevealScrollView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  totalCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  totalLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  totalHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  breakdown: {
    gap: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  breakdownLabel: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  form: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.base,
  },
  fieldLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
  },
  addText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.base,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowCategory: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  rowMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
})
