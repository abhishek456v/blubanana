import { View, Text, StyleSheet } from 'react-native'
import type { DealStatus } from '@/types'
import { Typography, FontFamily, Spacing, Radius } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { STATUS_LABELS } from '@/constants/labels'

// Colour is a second signal on top of the label, never the
// only one, and every pill still carries its text.
// neutral → nothing to react to yet (intake)
// warning → active production, something is due (script/shoot/edit)
// info    → waiting on an external party (published, payment awaited)
// success → done (paid)
type PillVariant = 'neutral' | 'warning' | 'info' | 'success'

function getVariant(status: DealStatus): PillVariant {
  switch (status) {
    case 'paid':
      return 'success'
    case 'published':
    case 'payment_awaited':
      return 'info'
    case 'script_due':
    case 'shooting':
    case 'editing':
      return 'warning'
    case 'intake':
      return 'neutral'
  }
}

export interface StatusPillProps {
  status: DealStatus
  /**
   * Renders on glass for use on a gradient card.
   *
   * The status hues are picked to sit on the page ground and lose most of
   * their contrast on a saturated one — `warning` on the blue card is close to
   * unreadable. The label is the primary signal by design (see above), so on a
   * gradient the pill keeps the words at full white and drops the hue rather
   * than keeping a colour that no longer reads.
   */
  onGradient?: boolean
}

export function StatusPill({ status, onGradient = false }: StatusPillProps) {
  const { c } = useTheme()
  const variant = getVariant(status)
  const label = STATUS_LABELS[status]

  if (onGradient) {
    return (
      <View style={[styles.pill, styles.glass]}>
        {variant === 'success' ? null : <View style={[styles.dot, styles.dotOnGlass]} />}
        <Text style={[styles.text, styles.textOnGlass]}>
          {variant === 'success' ? `✓ ${label}` : label}
        </Text>
      </View>
    )
  }

  if (variant === 'neutral') {
    return (
      <View style={[styles.pill, styles.outline, { borderColor: c.border }]}>
        <Text style={[styles.text, { color: c.textSecondary, fontFamily: FontFamily.regular }]}>
          {label}
        </Text>
      </View>
    )
  }

  const tone =
    variant === 'success'
      ? { fg: c.success, bg: c.successLight }
      : variant === 'info'
        ? { fg: c.info, bg: c.infoLight }
        : { fg: c.warning, bg: c.warningLight }

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      {variant === 'success' ? (
        <Text style={[styles.text, { color: tone.fg, fontFamily: FontFamily.medium }]}>
          ✓ {label}
        </Text>
      ) : (
        <>
          <View style={[styles.dot, { backgroundColor: tone.fg }]} />
          <Text style={[styles.text, { color: tone.fg, fontFamily: FontFamily.medium }]}>
            {label}
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  outline: {
    borderWidth: 1,
  },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingVertical: 5,
    paddingHorizontal: Spacing.base,
  },
  dotOnGlass: {
    backgroundColor: '#FFFFFF',
  },
  textOnGlass: {
    color: '#FFFFFF',
    fontFamily: FontFamily.medium,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
})
