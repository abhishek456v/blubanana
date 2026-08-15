import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Deliverable, DeliverableKind, Platform } from '@/types'
import {
  DEFAULT_PLATFORM_FOR_KIND,
  DELIVERABLE_KINDS,
  DELIVERABLE_LABELS,
} from '@/constants/labels'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { adRightsExpiry, adRightsPerMonth } from '@/lib/deliverables'
import { formatCurrency, formatDateLong } from '@/lib/format'
import { Button, Chip, DateField, PressableScale, Sheet, TextField } from '@/components/ui'

/** Editor working copy. Numbers stay strings so a half-typed rate is valid. */
export interface DeliverableDraft {
  /** Present when editing a saved row; absent for a new one. */
  id?: string
  kind: DeliverableKind
  platform: Platform | null
  quantity: number
  description: string
  rate: string
  due_date: string | null
  live_link: string | null
  published_at: string | null
  duration_months: string
  starts_on: string | null
}

export function emptyDraft(): DeliverableDraft {
  return {
    kind: 'reel',
    platform: DEFAULT_PLATFORM_FOR_KIND.reel,
    quantity: 1,
    description: '',
    rate: '',
    due_date: null,
    live_link: null,
    published_at: null,
    duration_months: '',
    starts_on: null,
  }
}

export function draftFromDeliverable(deliverable: Deliverable): DeliverableDraft {
  return {
    id: deliverable.id,
    kind: deliverable.kind,
    platform: deliverable.platform,
    quantity: deliverable.quantity,
    description: deliverable.description ?? '',
    rate: deliverable.rate ? String(deliverable.rate) : '',
    due_date: deliverable.due_date,
    live_link: deliverable.live_link,
    published_at: deliverable.published_at,
    duration_months: deliverable.duration_months ? String(deliverable.duration_months) : '',
    starts_on: deliverable.starts_on,
  }
}

interface DeliverableEditorProps {
  visible: boolean
  draft: DeliverableDraft | null
  onClose: () => void
  onSave: (draft: DeliverableDraft) => void
  onDelete?: () => void
}

/**
 * Add or edit one line item on a deal.
 *
 * Ad rights get their own set of fields because they are priced as a licence,
 * not as a piece of content — a duration and a window rather than a due date.
 * The monthly figure updates as the fee and duration are typed, which is the
 * number that makes an ad-rights quote comparable to the next brand's offer.
 */
export function DeliverableEditor({
  visible,
  draft,
  onClose,
  onSave,
  onDelete,
}: DeliverableEditorProps) {
  const { c } = useTheme()
  const [working, setWorking] = useState<DeliverableDraft>(draft ?? emptyDraft())

  // Reseeded each time the sheet opens so editing one row never shows the
  // previous row's values for a frame.
  useEffect(() => {
    if (visible && draft) setWorking(draft)
  }, [visible, draft])

  const isAdRights = working.kind === 'ad_rights'
  const isAutoDm = working.kind === 'auto_dm'
  const isContent = !isAdRights && !isAutoDm

  const feeValue = Number(working.rate) || 0
  const monthsValue = Number(working.duration_months) || 0
  const perMonth = adRightsPerMonth(feeValue, monthsValue)
  const expiry = adRightsExpiry(working.starts_on, monthsValue)

  function update<K extends keyof DeliverableDraft>(key: K, value: DeliverableDraft[K]) {
    setWorking((current) => ({ ...current, [key]: value }))
  }

  function changeKind(kind: DeliverableKind) {
    setWorking((current) => ({
      ...current,
      kind,
      // Platform follows the kind unless the creator picked one explicitly for
      // a content type; ad rights and auto DM carry none at all.
      platform: DEFAULT_PLATFORM_FOR_KIND[kind],
    }))
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={working.id ? 'Edit item' : 'Add item'}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>What is it?</Text>
          <View style={styles.kindGrid}>
            {DELIVERABLE_KINDS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={working.kind === option.key}
                onPress={() => changeKind(option.key)}
              />
            ))}
          </View>
        </View>

        <TextField
          label="Details"
          placeholder={
            isAdRights
              ? 'Whitelisting for the moisturiser campaign'
              : isAutoDm
                ? 'Comment-to-DM on the reel'
                : '60-second reel, hook in first 3 seconds'
          }
          value={working.description}
          onChangeText={(value) => update('description', value)}
        />

        {isContent ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.textSecondary }]}>How many?</Text>
            <Stepper
              value={working.quantity}
              onChange={(value) => update('quantity', value)}
            />
          </View>
        ) : null}

        <TextField
          label={isAdRights ? 'Ad rights fee' : 'Rate'}
          prefix="₹"
          placeholder="0"
          keyboardType="number-pad"
          value={working.rate}
          onChangeText={(value) => update('rate', value.replace(/[^0-9]/g, ''))}
          hint={
            isContent && working.quantity > 1
              ? `Total for all ${working.quantity}, not per item`
              : undefined
          }
        />

        {isAdRights ? (
          <>
            <TextField
              label="For how long?"
              placeholder="6"
              keyboardType="number-pad"
              value={working.duration_months}
              onChangeText={(value) => update('duration_months', value.replace(/[^0-9]/g, ''))}
              trailing={
                <Text style={[styles.suffix, { color: c.textMuted }]}>
                  {monthsValue === 1 ? 'month' : 'months'}
                </Text>
              }
            />

            <DateField
              label="Rights start"
              value={working.starts_on}
              onChange={(value) => update('starts_on', value)}
              hint={expiry ? `Ends ${formatDateLong(expiry)}` : undefined}
            />

            {/* The whole point of capturing a duration: what the licence is
                worth per month, so it can be compared against the next offer. */}
            {perMonth != null ? (
              <View style={[styles.calc, { backgroundColor: c.accentLight }]}>
                <Ionicons name="calculator-outline" size={17} color={c.accent} />
                <View style={styles.calcText}>
                  <Text style={[styles.calcValue, { color: c.accentText }]}>
                    {formatCurrency(perMonth)} per month
                  </Text>
                  <Text style={[styles.calcHint, { color: c.textSecondary }]}>
                    {formatCurrency(feeValue)} over {monthsValue}{' '}
                    {monthsValue === 1 ? 'month' : 'months'}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <DateField
            label="Due"
            value={working.due_date}
            onChange={(value) => update('due_date', value)}
          />
        )}

        <View style={styles.actions}>
          {onDelete ? (
            <Button label="Remove" variant="danger" onPress={onDelete} style={styles.action} />
          ) : null}
          <Button
            label={working.id ? 'Save' : 'Add'}
            onPress={() => onSave(working)}
            style={styles.action}
          />
        </View>
      </ScrollView>
    </Sheet>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { c } = useTheme()

  return (
    <View style={[styles.stepper, { borderColor: c.borderStrong }]}>
      <PressableScale
        onPress={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        hitSlop={HitSlop}
        haptic="selection"
        accessibilityLabel="Decrease quantity"
        style={styles.stepperButton}
      >
        <Ionicons name="remove" size={18} color={value <= 1 ? c.textMuted : c.textPrimary} />
      </PressableScale>

      <Text style={[styles.stepperValue, { color: c.textPrimary }]}>{value}</Text>

      <PressableScale
        onPress={() => onChange(Math.min(99, value + 1))}
        hitSlop={HitSlop}
        haptic="selection"
        accessibilityLabel="Increase quantity"
        style={styles.stepperButton}
      >
        <Ionicons name="add" size={18} color={c.textPrimary} />
      </PressableScale>
    </View>
  )
}

/** Label for a saved row — "Story ×3", "Ad rights · 6 months". */
export function deliverableSummary(deliverable: Deliverable): string {
  const label = DELIVERABLE_LABELS[deliverable.kind]
  if (deliverable.kind === 'ad_rights' && deliverable.duration_months) {
    return `${label} · ${deliverable.duration_months} months`
  }
  return deliverable.quantity > 1 ? `${label} ×${deliverable.quantity}` : label
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suffix: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  calc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  calcText: {
    flex: 1,
  },
  calcValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  calcHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.full,
    height: 40,
    paddingHorizontal: 4,
    gap: Spacing.sm,
  },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
    minWidth: 22,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  action: {
    flex: 1,
  },
})
