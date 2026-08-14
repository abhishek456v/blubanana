import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import type { Deliverable } from '@/types'
import { COMMERCIAL_KINDS, DELIVERABLE_LABELS } from '@/constants/labels'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { adRightsBreakdown, adRightsExpiry, contentValue, totalDealValue } from '@/lib/deliverables'
import { formatCurrency, formatDate, formatRelativeDay } from '@/lib/format'
import { Button, Card, PressableScale, useConfirm } from '@/components/ui'
import {
  DeliverableEditor,
  deliverableSummary,
  draftFromDeliverable,
  emptyDraft,
  type DeliverableDraft,
} from './DeliverableEditor'

interface DeliverablesCardProps {
  deliverables: Deliverable[]
  /** Called with the full replacement list whenever anything changes. */
  onChange: (drafts: DeliverableDraft[]) => void
  disabled?: boolean
}

/**
 * The "what did I actually sell them?" card.
 *
 * Replaces a single free-text deliverable field. A collaboration is normally a
 * reel *and* three stories *and* an auto-DM setup — and increasingly the ad
 * rights on top, which is often the most valuable line and the easiest to
 * forget to charge for.
 */
export function DeliverablesCard({ deliverables, onChange, disabled }: DeliverablesCardProps) {
  const { c } = useTheme()
  const confirm = useConfirm()

  const [editing, setEditing] = useState<DeliverableDraft | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const total = totalDealValue(deliverables)
  const content = contentValue(deliverables)
  const adRightsTotal = total - content

  function toDrafts(): DeliverableDraft[] {
    return deliverables.map(draftFromDeliverable)
  }

  function openNew() {
    setEditingIndex(null)
    setEditing(emptyDraft())
  }

  function openExisting(index: number) {
    setEditingIndex(index)
    setEditing(draftFromDeliverable(deliverables[index]))
  }

  function handleSave(draft: DeliverableDraft) {
    const next = toDrafts()
    // Ad-rights expiry is stored, not derived at read time, so it has to be
    // recomputed here whenever the start date or duration changes.
    const withExpiry: DeliverableDraft = { ...draft }
    if (editingIndex === null) next.push(withExpiry)
    else next[editingIndex] = withExpiry

    onChange(next)
    setEditing(null)
    setEditingIndex(null)
  }

  async function handleDelete() {
    if (editingIndex === null) return
    const label = DELIVERABLE_LABELS[deliverables[editingIndex].kind]
    if (!(await confirm({ title: `Remove ${label}?`, destructive: true, confirmLabel: 'Remove' })))
      return

    const next = toDrafts()
    next.splice(editingIndex, 1)
    onChange(next)
    setEditing(null)
    setEditingIndex(null)
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.textPrimary }]}>Deliverables</Text>
          {deliverables.length > 0 ? (
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {formatCurrency(content)}
              {adRightsTotal > 0 ? ` + ${formatCurrency(adRightsTotal)} ad rights` : ''}
            </Text>
          ) : null}
        </View>

        {!disabled ? (
          <PressableScale
            onPress={openNew}
            accessibilityLabel="Add deliverable"
            style={[styles.addButton, { backgroundColor: c.accentLight }]}
          >
            <Ionicons name="add" size={18} color={c.accent} />
          </PressableScale>
        ) : null}
      </View>

      {deliverables.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Nothing added yet. A reel, three stories, an auto DM, the ad rights — each priced on
            its own.
          </Text>
          {!disabled ? (
            <Button label="Add the first item" variant="secondary" size="sm" onPress={openNew} />
          ) : null}
        </View>
      ) : (
        <Animated.View layout={LinearTransition.duration(200)} style={styles.list}>
          {deliverables.map((deliverable, index) => (
            <DeliverableRow
              key={deliverable.id || `draft-${index}`}
              deliverable={deliverable}
              onPress={disabled ? undefined : () => openExisting(index)}
            />
          ))}
        </Animated.View>
      )}

      {deliverables.length > 1 ? (
        <View style={[styles.totalRow, { borderTopColor: c.border }]}>
          <Text style={[styles.totalLabel, { color: c.textSecondary }]}>Deal total</Text>
          <Text style={[styles.totalValue, { color: c.textPrimary }]}>{formatCurrency(total)}</Text>
        </View>
      ) : null}

      <DeliverableEditor
        visible={editing !== null}
        draft={editing}
        onClose={() => {
          setEditing(null)
          setEditingIndex(null)
        }}
        onSave={handleSave}
        onDelete={editingIndex !== null ? handleDelete : undefined}
      />
    </Card>
  )
}

function DeliverableRow({
  deliverable,
  onPress,
}: {
  deliverable: Deliverable
  onPress?: () => void
}) {
  const { c } = useTheme()
  const isCommercial = COMMERCIAL_KINDS.includes(deliverable.kind)
  const breakdown = adRightsBreakdown(deliverable)

  // Expiry can be stale if the row was edited before a save round-trip, so
  // fall back to recomputing it from the terms we hold.
  const expiry =
    deliverable.expires_on ?? adRightsExpiry(deliverable.starts_on, deliverable.duration_months)

  const meta = deliverable.published_at
    ? `Live ${formatDate(deliverable.published_at)}`
    : expiry
      ? `Ends ${formatDate(expiry)}`
      : deliverable.due_date
        ? `Due ${formatRelativeDay(deliverable.due_date).toLowerCase()}`
        : null

  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={deliverableSummary(deliverable)}
        style={[styles.row, { backgroundColor: c.bgPage }]}
      >
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: isCommercial ? c.accentLight : c.bgSurface },
          ]}
        >
          <Ionicons
            name={iconFor(deliverable.kind)}
            size={16}
            color={isCommercial ? c.accent : c.textSecondary}
          />
        </View>

        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={1}>
            {deliverableSummary(deliverable)}
          </Text>
          {deliverable.description ? (
            <Text style={[styles.rowMeta, { color: c.textSecondary }]} numberOfLines={1}>
              {deliverable.description}
            </Text>
          ) : null}
          {meta ? (
            <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {/* The per-month figure, surfaced without needing to open the row. */}
          {breakdown ? (
            <Text style={[styles.rowCalc, { color: c.accentText }]} numberOfLines={1}>
              {formatCurrency(breakdown.perMonth)}/month
            </Text>
          ) : null}
        </View>

        <Text style={[styles.rowRate, { color: c.textPrimary }]}>
          {formatCurrency(deliverable.rate)}
        </Text>
      </PressableScale>
    </Animated.View>
  )
}

function iconFor(kind: Deliverable['kind']): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'reel':
    case 'yt_short':
      return 'videocam'
    case 'story':
      return 'ellipse-outline'
    case 'carousel':
      return 'images'
    case 'static_post':
      return 'image'
    case 'yt_long':
    case 'yt_integration':
      return 'logo-youtube'
    case 'live':
      return 'radio'
    case 'ad_rights':
      return 'megaphone'
    case 'auto_dm':
      return 'chatbubble-ellipses'
    default:
      return 'ellipsis-horizontal'
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  subtitle: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  emptyText: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 19,
  },
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  rowMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  rowCalc: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
    marginTop: 1,
  },
  rowRate: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.display,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  totalValue: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
})
