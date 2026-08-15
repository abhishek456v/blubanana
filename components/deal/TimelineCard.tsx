import { StyleSheet, View } from 'react-native'
import type { DealStatus } from '@/types'
import { Spacing } from '@/constants/design'
import { formatRelativeDay } from '@/lib/format'
import { Card, DateField, StageTimeline, type StageState, type TimelineStage } from '@/components/ui'

export interface TimelineCardProps {
  status: DealStatus
  scriptDue: string
  shootDate: string
  editDone: string
  publishDate: string
  onChange: (field: 'script' | 'shoot' | 'edit' | 'publish', value: string) => void
}

/** How far through the workflow each status sits. */
const STAGE_INDEX: Record<DealStatus, number> = {
  intake: 0,
  script_due: 0,
  shooting: 1,
  editing: 2,
  published: 4,
  payment_awaited: 4,
  paid: 4,
}

/**
 * The deal's workflow: where it is now, and every date behind and ahead of it.
 *
 * Replaces a 2×2 grid of bare `TextInput`s labelled "Timeline (YYYY-MM-DD)".
 * Two problems with that: hand-typing an ISO date is the worst input pattern
 * in the app, and four dates in boxes never showed *which one is next*,
 * which is the only thing the screen needs to say, given the product's first
 * promise is that she never misses a deadline.
 */
export function TimelineCard({
  status,
  scriptDue,
  shootDate,
  editDone,
  publishDate,
  onChange,
}: TimelineCardProps) {
  const current = STAGE_INDEX[status]

  const stageState = (index: number, date: string): StageState => {
    // A stage with no date was never part of this deal (a story repost has
    // no script day), so it reads as skipped rather than pending forever.
    if (!date && index > current) return 'skipped'
    if (index < current) return 'done'
    if (index === current) return 'current'
    return 'upcoming'
  }

  const stages: TimelineStage[] = [
    { key: 'script', label: 'Script', date: scriptDue },
    { key: 'shoot', label: 'Shoot', date: shootDate },
    { key: 'edit', label: 'Edit', date: editDone },
    { key: 'publish', label: 'Publish', date: publishDate },
  ].map((stage, index) => ({
    key: stage.key,
    label: stage.label,
    detail: stage.date ? formatRelativeDay(stage.date) : 'No date set',
    state: stageState(index, stage.date),
  }))

  return (
    <Card>
      <StageTimeline stages={stages} />

      <View style={styles.fields}>
        <DateField
          label="Script"
          value={scriptDue || null}
          onChange={(value) => onChange('script', value ?? '')}
          placeholder="Not set"
        />
        <DateField
          label="Shoot"
          value={shootDate || null}
          onChange={(value) => onChange('shoot', value ?? '')}
          placeholder="Not set"
        />
        <DateField
          label="Edit"
          value={editDone || null}
          onChange={(value) => onChange('edit', value ?? '')}
          placeholder="Not set"
        />
        <DateField
          label="Publish"
          value={publishDate || null}
          onChange={(value) => onChange('publish', value ?? '')}
          placeholder="Not set"
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  fields: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
})
