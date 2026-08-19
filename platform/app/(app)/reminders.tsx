import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import {
  describeWhen,
  getAlertFeed,
  EMPTY_FEED,
  type Alert,
  type AlertFeed,
  type ReminderAlert,
} from '@/lib/alerts'
import { respondToChainReminder, type ReminderResponse } from '@/lib/reminderChains'
import { formatCurrency } from '@/lib/format'
import { REMINDER_STAGE_LABELS } from '@/constants/labels'
import {
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { BrandAvatar } from '@/components/BrandAvatar'
import {
  Card,
  EmptyState,
  HeaderUtilities,
  PressableScale,
  Reveal,
  RevealScrollView,
  ScreenHeader,
  SegmentedControl,
  SkeletonList,
  StatTile,
  useToast,
} from '@/components/ui'

type Tab = 'today' | 'upcoming'

const TABS = [
  { key: 'today' as const, label: 'Today' },
  { key: 'upcoming' as const, label: 'Upcoming' },
]

// The three answers a reminder accepts. "Done" closes the chain's live slot;
// the two snoozes create a fresh row so the nudge history survives (three
// snoozes on one stage is a real signal that a deadline is slipping).
const RESPONSES: {
  key: ReminderResponse
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'done', label: 'Done', icon: 'checkmark' },
  { key: 'snooze_12h', label: '12 hrs', icon: 'time-outline' },
  { key: 'snooze_tomorrow', label: 'Tomorrow', icon: 'calendar-outline' },
]

/**
 * Reminders.
 *
 * Two questions, split by time. *Today* is everything asking for an answer
 * right now: scheduled reminders whose moment has arrived, plus the alerts
 * derived from deal state (a payment eight days late, a published post with no
 * link). *Upcoming* is the diary: what is coming and when.
 *
 * Only the scheduled reminders carry the three response buttons. A derived
 * alert has nothing to snooze. It clears when the fact behind it changes, so
 * it opens the deal instead.
 */
export default function RemindersScreen() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('today')
  const [feed, setFeed] = useState<AlertFeed>(EMPTY_FEED)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [answering, setAnswering] = useState<string | null>(null)

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        setFeed(await getAlertFeed())
      } catch {
        toast('Could not load your reminders', { tone: 'error' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast]
  )

  useFocusEffect(
    useCallback(() => {
      load('initial')
    }, [load])
  )

  const overdueCount = useMemo(
    () =>
      feed.today.filter(
        (alert) => alert.kind === 'derived' && alert.item.tone === 'danger'
      ).length,
    [feed]
  )

  async function respond(alert: ReminderAlert, response: ReminderResponse) {
    if (answering) return
    setAnswering(alert.id)
    try {
      await respondToChainReminder(alert.reminder, response)
      toast(
        response === 'done'
          ? 'Marked done'
          : response === 'snooze_12h'
            ? 'Back in 12 hours'
            : 'Back tomorrow',
        { tone: response === 'done' ? 'success' : 'neutral' }
      )
      // Refetched rather than patched locally: a snooze inserts a new row and
      // may escalate, so the server's version is the only accurate one.
      await load('refresh')
    } catch {
      toast('Could not update that reminder', { tone: 'error' })
    } finally {
      setAnswering(null)
    }
  }

  const list: Alert[] = tab === 'today' ? feed.today : feed.upcoming

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <Stack.Screen options={{ title: 'Reminders' }} />
      <RevealScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={c.textMuted}
            colors={[c.accent]}
          />
        }
      >
        <ScreenHeader
          style={styles.headerFlush}
          title="Reminders"
          subtitle="What is asking for you, and what is coming."
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)' as never))}
          backLabel="Home"
          // No bell here: it is the control that opens this screen.
          leadingAction={<HeaderUtilities showBell={false} />}
        >
          {/* Two tiles on a phone, three on desktop. Wrapping 2+1 put the
              third tile on its own line where, on native, it rendered
              underneath the segmented control below it. The dropped tile is
              also the least useful one here: "Coming up" is just the count
              of the Upcoming tab, which is one tap away. */}
          <View style={styles.tiles}>
            <StatTile
              label="Needs an answer"
              value={feed.today.length}
              tone={feed.today.length > 0 ? 'warning' : 'default'}
              caption={feed.today.length === 0 ? 'all clear' : 'waiting on you'}
              index={0}
            />
            <StatTile
              label="Overdue"
              value={overdueCount}
              tone={overdueCount > 0 ? 'danger' : 'default'}
              caption={overdueCount > 0 ? 'past their date' : 'nothing late'}
              index={1}
            />
            {isDesktop ? (
              <StatTile
                label="Coming up"
                value={feed.upcoming.length}
                caption="scheduled ahead"
                index={2}
              />
            ) : null}
          </View>

          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </ScreenHeader>

        {loading ? (
          <SkeletonList count={4} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={tab === 'today' ? 'checkmark-done-outline' : 'calendar-outline'}
            title={tab === 'today' ? 'Nothing waiting' : 'Nothing scheduled'}
            message={
              tab === 'today'
                ? 'No overdue payments, no missed deadlines, nothing to answer. Enjoy it.'
                : 'Add script, shoot, edit and publish dates to a deal. Each one shows up here before it lands.'
            }
            actionLabel="Add a deal"
            onAction={() => router.push('/(app)/deal/new' as never)}
          />
        ) : (
          <View style={isDesktop ? styles.grid : styles.list}>
            {list.map((alert, index) => (
              <View key={alert.id} style={isDesktop ? styles.gridCell : undefined}>
                <AlertCard alert={alert} index={index} />
              </View>
            ))}
          </View>
        )}
      </RevealScrollView>
    </SafeAreaView>
  )

  function AlertCard({ alert, index }: { alert: Alert; index: number }) {
    const isReminder = alert.kind === 'reminder'
    const deal = isReminder ? alert.deal : alert.item.deal
    // A tax reminder belongs to no deal and no brand (029), so the usual
    // fallback would label the government's deadline "Unknown brand".
    const brandName =
      deal?.brand?.name ??
      (isReminder && alert.reminder.type === 'tax' ? 'Tax' : 'Unknown brand')

    const tone = isReminder
      ? alert.at.getTime() <= Date.now()
        ? c.warning
        : c.textMuted
      : alert.item.tone === 'danger'
        ? c.danger
        : alert.item.tone === 'warning'
          ? c.warning
          : c.info

    const title = isReminder
      ? alert.reminder.title
      : `${brandName} · ${alert.item.reason}`

    const when = isReminder
      ? describeWhen(alert.at)
      : alert.item.reason

    return (
      <Animated.View
        entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(index))}
        style={isDesktop ? styles.fill : undefined}
      >
        <Card style={[styles.card, isDesktop && styles.fill]}>
          <PressableScale
            onPress={
              deal ? () => router.push(`/(app)/deal/${deal.id}` as never) : undefined
            }
            disabled={!deal}
            scaleTo={0.99}
            style={styles.cardHead}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${when}`}
          >
            <BrandAvatar name={brandName} size={38} />

            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: c.textPrimary }]} numberOfLines={2}>
                {isReminder ? title : brandName}
              </Text>
              <Text style={[styles.cardWhen, { color: tone }]} numberOfLines={2}>
                {isReminder && alert.reminder.stage
                  ? `${REMINDER_STAGE_LABELS[alert.reminder.stage]} · ${when}`
                  : when}
              </Text>
              {deal ? (
                <Text style={[styles.cardMeta, { color: c.textMuted }]} numberOfLines={1}>
                  {formatCurrency(deal.rate)}
                  {isReminder && alert.reminder.snooze_count > 0
                    ? ` · snoozed ${alert.reminder.snooze_count}×`
                    : ''}
                </Text>
              ) : null}
            </View>

            {isReminder && alert.reminder.escalation_level > 0 ? (
              <View style={[styles.flag, { backgroundColor: c.dangerLight }]}>
                <Ionicons name="alert-circle" size={13} color={c.danger} />
                <Text style={[styles.flagText, { color: c.danger }]}>Slipping</Text>
              </View>
            ) : null}
          </PressableScale>

          {isReminder ? (
            <View style={[styles.actions, { borderTopColor: c.border }]}>
              {RESPONSES.map((response) => (
                <PressableScale
                  key={response.key}
                  onPress={() => respond(alert, response.key)}
                  disabled={answering != null}
                  haptic={response.key === 'done' ? 'success' : 'selection'}
                  style={[
                    styles.action,
                    {
                      backgroundColor:
                        response.key === 'done' ? c.accentLight : c.bgPage,
                      opacity: answering != null && answering !== alert.id ? 0.5 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={response.label}
                >
                  <Ionicons
                    name={response.icon}
                    size={14}
                    color={response.key === 'done' ? c.accent : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      { color: response.key === 'done' ? c.accent : c.textSecondary },
                    ]}
                  >
                    {response.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
        </Card>
      </Animated.View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerFlush: {
    paddingHorizontal: 0,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.base,
    alignItems: 'stretch',
  },
  list: {
    gap: Spacing.base,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  gridCell: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  fill: {
    flex: 1,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  cardText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  cardWhen: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  cardMeta: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  flagText: {
    ...Typography.label,
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderTopWidth: 1,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    borderRadius: Radius.sm,
  },
  actionText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
})
