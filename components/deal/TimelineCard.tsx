import type { DealStatus } from '@/types'
import { formatRelativeDay } from '@/lib/format'
import { Card, DateField, StageTimeline, type StageState, type TimelineStage } from '@/components/ui'

export type TimelineStageKey = 'script' | 'shoot' | 'edit' | 'publish'

export interface TimelineCardProps {
  status: DealStatus
  scriptDue: string
  shootDate: string
  editDone: string
  publishDate: string
  onChange: (field: TimelineStageKey, value: string) => void
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
    // A stage with no date was never part of this deal (a story repost has no
    // script day), so it reads as skipped rather than pending forever.
    //
    // This has to hold on both sides of the current stage. Testing only
    // `index > current` meant a dateless stage the deal had already moved past
    // fell through to 'done' and drew a green tick: the timeline asserting
    // work that never happened, on the screen whose whole job is to say what
    // did. The current stage stays current either way, because that one is
    // where the deal actually is regardless of whether a date was recorded.
    if (!date && index !== current) return 'skipped'
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
    detail: stage.date ? formatRelativeDay(stage.date) : null,
    state: stageState(index, stage.date),
    // The date control lives on the stage row it belongs to. It used to sit
    // in a second list of four fields underneath, so the screen named Script,
    // Shoot, Edit and Publish twice and spent about 700px doing it.
    trailing: (
      <DateField
        variant="inline"
        value={stage.date || null}
        onChange={(value) => onChange(stage.key as TimelineStageKey, value ?? '')}
        placeholder="Set date"
      />
    ),
  }))

  return (
    <Card>
      <StageTimeline stages={stages} />
    </Card>
  )
}


