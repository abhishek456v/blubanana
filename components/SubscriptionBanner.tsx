import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TRIAL_DEAL_LIMIT } from '@/lib/subscription'
import { useEntitlement } from '@/hooks/useEntitlement'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Button, PressableScale } from '@/components/ui'

/**
 * The trial countdown, and the read-only prompt when it runs out (§3).
 *
 * Two states, and they are deliberately different in weight. The trial line is
 * a quiet reminder; the expired state is a full stop, because at that point
 * every write in the app is already failing and an ambiguous message would just
 * make it look broken.
 *
 * Renders nothing at all for a paying or internal workspace. A permanent
 * "you're subscribed" banner is clutter someone has already paid to not see.
 */
export function SubscriptionBanner() {
  const { c } = useTheme()
  const router = useRouter()
  const { canWrite, isTrialing, trialDaysLeft, dealsLeft, loading } = useEntitlement()

  if (loading) return null

  // ── Read-only ─────────────────────────────────────────────────────────────
  // §3 allows exactly two offers here: buy a plan, and export. Anything else
  // would be a third path out of a state she is meant to resolve.
  if (!canWrite) {
    return (
      <View style={[styles.stop, { backgroundColor: c.dangerLight }]}>
        <Text style={[styles.stopTitle, { color: c.textPrimary }]}>
          Your workspace is read-only
        </Text>
        <Text style={[styles.stopBody, { color: c.textSecondary }]}>
          Everything you have is still here and still yours to read or export. Adding
          and editing resume the moment you subscribe.
        </Text>
        <View style={styles.stopActions}>
          <Button
            label="See plans"
            onPress={() => router.push('/(app)/plans' as never)}
            fullWidth
          />
          <Button
            label="Export my data"
            variant="ghost"
            onPress={() => router.push('/(app)/(tabs)/settings' as never)}
            fullWidth
          />
        </View>
      </View>
    )
  }

  if (!isTrialing) return null

  // The deal cap is mentioned only once it is close. Naming a limit on day one
  // makes a generous trial sound stingy.
  const capNear = dealsLeft !== null && dealsLeft <= 3

  return (
    <PressableScale
      onPress={() => router.push('/(app)/plans' as never)}
      accessibilityRole="button"
      accessibilityLabel="See plans"
      style={[styles.trial, { backgroundColor: c.accentLight }]}
    >
      <Ionicons name="time-outline" size={16} color={c.accent} />
      <Text style={[styles.trialText, { color: c.accentText }]} numberOfLines={2}>
        {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left in your trial
        {capNear
          ? dealsLeft === 0
            ? ` · you have used all ${TRIAL_DEAL_LIMIT} trial deals`
            : ` · ${dealsLeft} more ${dealsLeft === 1 ? 'deal' : 'deals'} on the trial`
          : ''}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={c.accent} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  trial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  trialText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  stop: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  stopTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  stopBody: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  stopActions: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
})
