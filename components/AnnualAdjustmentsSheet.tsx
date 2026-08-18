import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import type { AnnualAdjustments } from '@/lib/annualReport'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Button, Sheet, TextField } from '@/components/ui'

export interface AnnualAdjustmentsSheetProps {
  visible: boolean
  fyLabel: string
  adjustments: AnnualAdjustments
  saving?: boolean
  onClose: () => void
  onSave: (next: AnnualAdjustments) => void
}

/** Signed, so a refund can be entered as a correction downward. */
function toAmount(text: string): number {
  const negative = text.trim().startsWith('-')
  const digits = text.replace(/[^0-9]/g, '')
  const value = digits ? parseInt(digits, 10) : 0
  return negative ? -value : value
}

function fromAmount(value: number): string {
  return value === 0 ? '' : String(value)
}

/**
 * What the app never saw (§8.13).
 *
 * These are additions, not corrections to the computed totals, and the report
 * shows both sides. The distinction matters at the moment it is used: her
 * accountant needs to know which figures came from records the app can produce
 * and which came from her memory, and an editable total erases that difference
 * permanently.
 *
 * Every field accepts a negative number, because a refunded deal or a
 * double-counted payment is a real correction downward — and a form that only
 * accepts positives forces her to fudge it somewhere else.
 */
export function AnnualAdjustmentsSheet({
  visible,
  fyLabel,
  adjustments,
  saving,
  onClose,
  onSave,
}: AnnualAdjustmentsSheetProps) {
  const { c } = useTheme()
  const [draft, setDraft] = useState(adjustments)

  useEffect(() => {
    if (visible) setDraft(adjustments)
  }, [visible, adjustments])

  return (
    <Sheet visible={visible} onClose={onClose} title={`Add to ${fyLabel}`}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: c.textSecondary }]}>
          Anything this app never saw — AdSense, affiliate income, a deal paid outside
          CreatorDesk, an expense paid in cash, or TDS showing in your 26AS from a brand
          that never invoiced here.
        </Text>
        <Text style={[styles.intro, { color: c.textMuted }]}>
          These are added to your figures, not instead of them. The report keeps showing
          both, so your accountant can tell them apart. Start with a minus for a refund
          or a correction downward.
        </Text>

        <TextField
          label="Other income"
          prefix="₹"
          keyboardType="numbers-and-punctuation"
          value={fromAmount(draft.otherIncome)}
          onChangeText={(v) => setDraft((p) => ({ ...p, otherIncome: toAmount(v) }))}
          placeholder="0"
        />
        <TextField
          label="Other expenses"
          prefix="₹"
          keyboardType="numbers-and-punctuation"
          value={fromAmount(draft.otherExpenses)}
          onChangeText={(v) => setDraft((p) => ({ ...p, otherExpenses: toAmount(v) }))}
          placeholder="0"
        />
        <TextField
          label="Other TDS deducted"
          prefix="₹"
          keyboardType="numbers-and-punctuation"
          value={fromAmount(draft.otherTds)}
          onChangeText={(v) => setDraft((p) => ({ ...p, otherTds: toAmount(v) }))}
          placeholder="0"
        />
        <TextField
          label="Other GST collected"
          prefix="₹"
          keyboardType="numbers-and-punctuation"
          value={fromAmount(draft.otherGst)}
          onChangeText={(v) => setDraft((p) => ({ ...p, otherGst: toAmount(v) }))}
          placeholder="0"
        />
        <TextField
          label="What these are"
          value={draft.note ?? ''}
          onChangeText={(v) => setDraft((p) => ({ ...p, note: v }))}
          multiline
          placeholder="AdSense Apr–Mar, one barter deal, cash paid to editor"
          hint="You will not remember in January. Your accountant will ask."
        />

        <Button
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => onSave(draft)}
          disabled={saving}
          fullWidth
        />
        <Button label="Cancel" variant="ghost" onPress={onClose} disabled={saving} fullWidth />
      </ScrollView>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 440 },
  intro: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
})
