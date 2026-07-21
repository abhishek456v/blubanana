import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { getPaymentAlertTone } from '@/lib/paymentReminders'
import type { DealStatus, Platform } from '@/types'
import { STATUS_LABELS, PLATFORMS } from '@/constants/labels'
import { DealRow } from '@/components/DealRow'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

type StatusFilter = DealStatus | 'all'
type PlatformFilter = Platform | 'all'

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...(Object.keys(STATUS_LABELS) as DealStatus[]).map((key) => ({
    key,
    label: STATUS_LABELS[key],
  })),
]

const PLATFORM_OPTIONS: { key: PlatformFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...PLATFORMS,
]

// Payment-due spans any deal status, not just 'payment_awaited' — a deal
// still in 'published' can already have an overdue-looking due date if the
// creator entered the timeline retroactively (PRODUCT.md 2.2 "payment-due").
function isPaymentDue(deal: DealWithPaymentSummary): boolean {
  return deal.payment !== null && getPaymentAlertTone(deal.payment) !== null
}

function applyFilters(
  deals: DealWithPaymentSummary[],
  status: StatusFilter,
  platform: PlatformFilter,
  paymentDueOnly: boolean
): DealWithPaymentSummary[] {
  return deals.filter((d) => {
    if (status !== 'all' && d.status !== status) return false
    if (platform !== 'all' && d.platform !== platform) return false
    if (paymentDueOnly && !isPaymentDue(d)) return false
    return true
  })
}

export default function DashboardScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const router = useRouter()
  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [paymentDueOnly, setPaymentDueOnly] = useState(false)

  const fetchDeals = useCallback(async () => {
    try {
      const data = await getDeals()
      setDeals(data)
    } catch {
      Alert.alert('Error', 'Could not load deals.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch every time this tab comes into focus, so new deals added from
  // the deal form appear immediately when the user navigates back here.
  // Wrapped in a sync callback — useFocusEffect throws if it receives an async
  // function directly because a Promise looks like a non-cleanup return value.
  useFocusEffect(
    useCallback(() => {
      fetchDeals()
    }, [fetchDeals])
  )

  const filtered = applyFilters(deals, statusFilter, platformFilter, paymentDueOnly)
  const noFiltersApplied = statusFilter === 'all' && platformFilter === 'all' && !paymentDueOnly

  function PillRow<T extends string>({
    options,
    active,
    onSelect,
  }: {
    options: { key: T; label: string }[]
    active: T
    onSelect: (key: T) => void
  }) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {options.map((opt) => {
          const selected = opt.key === active
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              style={[
                styles.filterPill,
                selected
                  ? { backgroundColor: c.fillPrimary }
                  : { borderWidth: 1, borderColor: c.border },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: selected ? c.onFillPrimary : c.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    )
  }

  const FilterBar = (
    <View style={styles.filterBar}>
      <Text style={[styles.filterLabel, { color: c.textMuted }]}>Status</Text>
      <PillRow options={STATUS_OPTIONS} active={statusFilter} onSelect={setStatusFilter} />

      <Text style={[styles.filterLabel, { color: c.textMuted }]}>Platform</Text>
      <PillRow options={PLATFORM_OPTIONS} active={platformFilter} onSelect={setPlatformFilter} />

      <TouchableOpacity
        onPress={() => setPaymentDueOnly((v) => !v)}
        style={[
          styles.filterPill,
          styles.paymentDuePill,
          paymentDueOnly
            ? { backgroundColor: c.fillPrimary }
            : { borderWidth: 1, borderColor: c.border },
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterPillText,
            { color: paymentDueOnly ? c.onFillPrimary : c.textSecondary },
          ]}
        >
          Payment due
        </Text>
      </TouchableOpacity>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: c.bgPage }]}
        edges={['bottom']}
      >
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={c.textMuted} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      edges={['bottom']}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DealRow
            deal={item}
            onPress={() => router.push(`/(app)/deal/${item.id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={FilterBar}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>
              {noFiltersApplied ? 'No deals yet' : 'No deals match these filters'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
              {noFiltersApplied
                ? 'Tap "Add deal" in the top right to log your first deal.'
                : 'Try different filters or add a new deal.'}
            </Text>
          </View>
        }
        contentContainerStyle={[styles.list, isWide && styles.listWide]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  filterLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  pillRow: {
    gap: Spacing.sm,
    paddingBottom: 2,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  paymentDuePill: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  filterPillText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  listWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  separator: {
    height: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  emptySubtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
})
