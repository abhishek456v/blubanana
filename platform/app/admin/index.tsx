import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import {
  getAdminFunnel,
  getAdminHealth,
  getAdminOverview,
  healthIssueCount,
  type AdminFunnel,
  type AdminHealth,
  type AdminOverview,
} from '@/lib/admin'
import {
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { roleCan, usePlatformRole, type AdminArea } from '@/hooks/usePlatformRole'
import { Card, MetricCard, PressableScale, Skeleton, useToast } from '@/components/ui'

interface Section {
  href: string
  area: AdminArea
  title: string
  hint: string
  icon: keyof typeof Ionicons.glyphMap
  /** A count to show on the right, if there is one worth showing. */
  badge?: (issues: number) => string | null
}

const SECTIONS: Section[] = [
  {
    href: '/admin/people',
    area: 'people',
    title: 'People',
    hint: 'Everyone using it, how far they got, and a way to reach them',
    icon: 'people-outline',
  },
  {
    href: '/admin/subscriptions',
    area: 'subscriptions',
    title: 'Subscriptions',
    hint: 'Who is paying, who is ending, and the levers to put something right',
    icon: 'card-outline',
  },
  {
    href: '/admin/support',
    area: 'support',
    title: 'Help',
    hint: 'What people have written in about',
    icon: 'chatbubbles-outline',
  },
  {
    href: '/admin/announcements',
    area: 'announcements',
    title: 'Broadcast',
    hint: 'A strip, a popup or a picture, on the app and the website',
    icon: 'megaphone-outline',
  },
  {
    href: '/admin/media',
    area: 'media',
    title: 'Media',
    hint: 'Pictures and video, for anywhere the product shows one',
    icon: 'images-outline',
  },
  {
    href: '/admin/flags',
    area: 'flags',
    title: 'Switches',
    hint: 'Turn part of the product off without shipping anything',
    icon: 'toggle-outline',
  },
  {
    href: '/admin/activity',
    area: 'activity',
    title: 'Activity',
    hint: 'The last things anybody did, across every workspace',
    icon: 'pulse-outline',
  },
  {
    href: '/admin/data-requests',
    area: 'requests',
    title: 'Data requests',
    hint: 'Copies and erasures, with the thirty day clock on each',
    icon: 'shield-checkmark-outline',
  },
]

/**
 * The one screen to open in the morning.
 *
 * Deliberately not a wall of charts. Google Analytics already covers traffic,
 * nobody watches a live dashboard, and the two questions actually worth asking
 * daily are whether anything is broken and whether anyone is getting started.
 * Both are answered above the fold; everything else is a click away.
 */
export default function AdminHome() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const { role } = usePlatformRole()
  const router = useRouter()
  const toast = useToast()

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      // Settled rather than all: a role that cannot reach one of these should
      // still get the two it can, rather than an empty screen.
      const [o, h, f] = await Promise.allSettled([
        getAdminOverview(),
        getAdminHealth(),
        getAdminFunnel(),
      ])
      if (o.status === 'fulfilled') setOverview(o.value)
      if (h.status === 'fulfilled') setHealth(h.value)
      if (f.status === 'fulfilled') setFunnel(f.value)
      if (o.status === 'rejected' && h.status === 'rejected' && f.status === 'rejected') {
        toast('Could not load the dashboard', { tone: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const issues = health ? healthIssueCount(health) : 0

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={[styles.eyebrow, { color: c.textMuted }]}>Blubanana admin</Text>
            <Text style={[styles.title, { color: c.textPrimary }]}>How is the business</Text>
          </View>
          <PressableScale
            onPress={() => router.replace('/(app)/(tabs)' as never)}
            accessibilityRole="button"
            accessibilityLabel="Back to the app"
            style={[styles.leave, { backgroundColor: c.bgSurface }]}
          >
            <Ionicons name="arrow-back" size={15} color={c.textSecondary} />
            <Text style={[styles.leaveText, { color: c.textSecondary }]}>Back to the app</Text>
          </PressableScale>
        </View>

        {loading ? (
          <View style={styles.section}>
            <Skeleton height={96} radius={Radius.lg} />
            <Skeleton height={140} radius={Radius.lg} />
          </View>
        ) : (
          <>
            {/* Is anything broken. First, because it is the only thing here
                that can be an emergency, and because the answer is usually
                "no" and takes one second to read. */}
            <PressableScale
              onPress={() => router.push('/admin/health' as never)}
              accessibilityRole="button"
              accessibilityLabel={
                issues === 0 ? 'Nothing is broken' : `${issues} things need attention`
              }
            >
              <Card
                style={[
                  styles.healthCard,
                  { backgroundColor: issues === 0 ? c.successLight : c.dangerLight },
                ]}
              >
              <View style={styles.healthRow}>
                <Ionicons
                  name={issues === 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={22}
                  color={issues === 0 ? c.success : c.danger}
                />
                <View style={styles.healthText}>
                  <Text
                    style={[styles.healthTitle, { color: issues === 0 ? c.success : c.danger }]}
                  >
                    {issues === 0
                      ? 'Nothing is broken'
                      : `${issues} ${issues === 1 ? 'thing needs' : 'things need'} attention`}
                  </Text>
                  <Text
                    style={[styles.healthMeta, { color: issues === 0 ? c.success : c.danger }]}
                  >
                    {issues === 0
                      ? 'Connections, reminders and messages are all behaving.'
                      : 'Expired connections, missed reminders or messages that never sent.'}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={issues === 0 ? c.success : c.danger}
                />
              </View>
              </Card>
            </PressableScale>

            {/* Is anyone getting started. The number that matters most for a
                product with a trial, and the one nothing reported until now. */}
            {funnel ? (
              <Card>
                <Text style={[styles.cardTitle, { color: c.textPrimary }]}>
                  Is anyone getting started
                </Text>
                <Text style={[styles.cardHint, { color: c.textSecondary }]}>
                  Of {funnel.total} {funnel.total === 1 ? 'person' : 'people'} who signed up.
                </Text>
                <View style={styles.funnel}>
                  {[
                    ['Added a brand', funnel.withBrand],
                    ['Added a deal', funnel.withDeal],
                    ['Raised an invoice', funnel.withInvoice],
                  ].map(([label, count]) => {
                    const pct = funnel.total ? Math.round((Number(count) / funnel.total) * 100) : 0
                    return (
                      <View key={String(label)} style={styles.step}>
                        <View style={styles.stepHead}>
                          <Text style={[styles.stepLabel, { color: c.textPrimary }]}>{label}</Text>
                          <Text style={[styles.stepCount, { color: c.textSecondary }]}>
                            {String(count)} of {funnel.total}
                          </Text>
                        </View>
                        <View style={[styles.track, { backgroundColor: c.bgSurface }]}>
                          <View
                            style={[styles.fill, { width: `${pct}%`, backgroundColor: c.accent }]}
                          />
                        </View>
                      </View>
                    )
                  })}
                </View>
              </Card>
            ) : null}

            {overview ? (
              <View style={styles.metrics}>
                <View style={styles.metricCell}>
                  <MetricCard label="Workspaces" value={overview.workspaces} index={0} />
                </View>
                <View style={styles.metricCell}>
                  <MetricCard
                    label="Paying"
                    value={overview.subscriptions.active ?? 0}
                    tone="accent"
                    caption="active subscriptions"
                    index={1}
                  />
                </View>
                <View style={styles.metricCell}>
                  <MetricCard
                    label="On trial"
                    value={overview.subscriptions.trialing ?? 0}
                    index={2}
                  />
                </View>
                <View style={styles.metricCell}>
                  <MetricCard label="Deals" value={overview.deals} index={3} />
                </View>
              </View>
            ) : null}

            {/* Everything else, in the order somebody actually needs it: what
                is broken, who is here, what they are paying, what they asked
                for, then the levers. A role that cannot reach an area does not
                see the link, so nobody is invited to a refusal. */}
            <View style={styles.links}>
              {SECTIONS.filter((section) => roleCan(role, section.area)).map((section) => (
                <PressableScale
                  key={section.href}
                  onPress={() => router.push(section.href as never)}
                  accessibilityRole="button"
                  accessibilityLabel={section.title}
                  style={[styles.link, { backgroundColor: c.bgSurface }]}
                >
                  <Ionicons name={section.icon} size={18} color={c.accent} />
                  <View style={styles.linkText}>
                    <Text style={[styles.linkTitle, { color: c.textPrimary }]}>
                      {section.title}
                    </Text>
                    <Text style={[styles.linkHint, { color: c.textSecondary }]}>
                      {section.hint}
                    </Text>
                  </View>
                  {section.badge && section.badge(issues) ? (
                    <View style={[styles.badge, { backgroundColor: c.danger }]}>
                      <Text style={styles.badgeText}>{section.badge(issues)}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </PressableScale>
              ))}
            </View>

            <Text style={[styles.footnote, { color: c.textMuted }]}>
              Signed in as {role}. Every screen here is recorded, including what it read.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  contentWide: {
    padding: Spacing.lg,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  headText: { flex: 1, gap: 2 },
  eyebrow: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...Typography.display,
    fontFamily: FontFamily.display,
  },
  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  leaveText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  section: { gap: Spacing.md },
  healthCard: { paddingVertical: Spacing.md },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  healthText: { flex: 1, gap: 2 },
  healthTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  healthMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  cardHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  funnel: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  step: { gap: Spacing.xs },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  stepLabel: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  stepCount: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  metricCell: {
    flexGrow: 1,
    flexBasis: 190,
  },
  links: { gap: Spacing.sm },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
  },
  linkText: { flex: 1, gap: 2 },
  linkTitle: { ...Typography.bodyStrong, fontFamily: FontFamily.medium },
  linkHint: { ...Typography.caption, fontFamily: FontFamily.regular },
  footnote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
})
