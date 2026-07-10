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
import { getDeals } from '@/lib/deals'
import type { Deal, DealStatus } from '@/types'
import { DealRow } from '@/components/DealRow'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'

type FilterKey = 'all' | 'active' | 'payment_awaited' | 'paid'

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'payment_awaited', label: 'Payment awaited' },
  { key: 'paid', label: 'Paid' },
]

const ACTIVE_STATUSES: DealStatus[] = [
  'intake',
  'script_due',
  'shooting',
  'editing',
  'published',
]

function applyFilter(deals: Deal[], filter: FilterKey): Deal[] {
  switch (filter) {
    case 'all':
      return deals
    case 'active':
      return deals.filter((d) => ACTIVE_STATUSES.includes(d.status))
    case 'payment_awaited':
      return deals.filter((d) => d.status === 'payment_awaited')
    case 'paid':
      return deals.filter((d) => d.status === 'paid')
  }
}

export default function DashboardScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light

  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')

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

  const filtered = applyFilter(deals, filter)

  const FilterBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBar}
    >
      {FILTER_OPTIONS.map((opt) => {
        const active = opt.key === filter
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setFilter(opt.key)}
            style={[
              styles.filterPill,
              active
                ? { backgroundColor: c.fillPrimary }
                : { borderWidth: 1, borderColor: c.border },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: active ? c.onFillPrimary : c.textSecondary },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
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
              {filter === 'all' ? 'No deals yet' : 'No deals in this filter'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
              {filter === 'all'
                ? 'Tap "Add deal" in the top right to log your first deal.'
                : 'Try a different filter or add a new deal.'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
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
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  filterPillText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
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
