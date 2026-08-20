import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { getDeals, nextDuePayment, type DealWithPaymentSummary } from '@/lib/deals'
import { getAttentionItems } from '@/lib/insights'
import { formatCurrency, formatDate } from '@/lib/format'
import type { DealStatus } from '@/types'
import { PLATFORM_LABELS, STATUS_LABELS } from '@/constants/labels'
import {
  DesktopContentMaxWidth,
  FontFamily,
  Spacing,
  Typography,
} from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { BrandAvatar } from '@/components/BrandAvatar'
import { ModalSheet } from '@/components/ModalSheet'
import { DealRow } from '@/components/DealRow'
import { StatusPill } from '@/components/StatusPill'
import {
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ScreenHeader,
  SkeletonList,
  TextField,
  useToast,
} from '@/components/ui'

type StatusFilter = DealStatus | 'all' | 'attention'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Reminders' },
  ...(Object.keys(STATUS_LABELS) as DealStatus[]).map((key) => ({
    key: key as StatusFilter,
    label: STATUS_LABELS[key],
  })),
]

/**
 * Every deal, with search and filters.
 *
 * Where "View all" goes (20 Aug redesign). Home and Money each show six rows
 * and then send you here rather than growing without limit, which is the
 * whole point of capping them: the dashboards stay readable because this
 * screen exists to hold the rest.
 *
 * Accepts a `?filter=` so a caller can land on a subset: Home's Reminders
 * panel opens this already narrowed to what is late.
 */
export default function DealsScreen() {
  const { c } = useTheme()
  const { session } = useAuth()
  const { isDesktop, isWide } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ filter?: string }>()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>(() => {
    const requested = params.filter
    return typeof requested === 'string' &&
      FILTERS.some((option) => option.key === requested)
      ? (requested as StatusFilter)
      : 'all'
  })

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        setDeals(await getDeals())
      } catch {
        // Silent without a session: the redirect to sign-in is already
        // running, and an error toast over a login screen is noise.
        if (session) toast('Could not load your deals', { tone: 'error' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast, session]
  )

  useFocusEffect(
    useCallback(() => {
      load('initial')
    }, [load])
  )

  const attentionIds = useMemo(
    () => new Set(getAttentionItems(deals).map((item) => item.deal.id)),
    [deals]
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return deals.filter((deal) => {
      if (filter === 'attention' && !attentionIds.has(deal.id)) return false
      if (filter !== 'all' && filter !== 'attention' && deal.status !== filter) return false
      if (!needle) return true

      return [deal.brand?.name, deal.deliverable_description, PLATFORM_LABELS[deal.platform]]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle))
    })
  }, [deals, filter, query, attentionIds])

  const total = useMemo(
    () => visible.reduce((sum, deal) => sum + (deal.rate ?? 0), 0),
    [visible]
  )

  const columns: DataTableColumn<DealWithPaymentSummary>[] = [
    {
      key: 'brand',
      title: 'Brand',
      flex: 2.1,
      render: (deal) => {
        const brandName = deal.brand?.name ?? 'Unknown brand'
        return (
          <View style={styles.brandCell}>
            <BrandAvatar name={brandName} size={26} />
            <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
              {brandName}
            </Text>
          </View>
        )
      },
    },
    {
      key: 'deliverable',
      title: 'Deliverable',
      flex: 1.7,
      render: (deal) => (
        <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
          {PLATFORM_LABELS[deal.platform] ?? deal.platform} · {deal.deliverable_description}
        </Text>
      ),
    },
    {
      key: 'amount',
      title: 'Amount',
      flex: 1,
      align: 'right',
      render: (deal) => (
        <Text style={[styles.cellAmount, { color: c.textPrimary }]} numberOfLines={1}>
          {formatCurrency(deal.rate)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      flex: 0.9,
      align: 'right',
      render: (deal) => <StatusPill status={deal.status} />,
    },
    {
      key: 'due',
      title: 'Due',
      flex: 0.7,
      align: 'right',
      render: (deal) => {
        const next = nextDuePayment(deal)
        return (
          <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
            {next?.due_date ? formatDate(next.due_date) : deal.status === 'paid' ? 'Paid' : '—'}
          </Text>
        )
      },
    },
  ]

  const header = (
    <ScreenHeader
      style={styles.headerFlush}
      // On wide screens the sheet's own chrome carries the name and the close
      // control, so this drops to the count line only.
      title={isWide ? '' : 'Deals'}
      subtitle={
        visible.length === deals.length
          ? `${deals.length} on record, ${formatCurrency(total)} in total`
          : `${visible.length} of ${deals.length}, ${formatCurrency(total)} in total`
      }
      onBack={isWide ? undefined : () => router.back()}
      backLabel="Back"
      actions={
        isWide
          ? undefined
          : [
              {
                icon: 'add',
                label: 'Add deal',
                primary: true,
                onPress: () => router.push('/(app)/deal/new' as never),
              },
            ]
      }
    >
      <TextField
        placeholder="Search brand, deliverable or platform"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={filter === option.key}
            onPress={() => setFilter(option.key)}
          />
        ))}
      </View>

      {/* Desktop shows the whole set as one table; there is no cap here,
          because this screen is what the caps elsewhere point at. */}
      {isDesktop && visible.length > 0 ? (
        <DataTable
          columns={columns}
          rows={visible}
          keyOf={(deal) => deal.id}
          onRowPress={(deal) => router.push(`/(app)/deal/${deal.id}` as never)}
        />
      ) : null}
    </ScreenHeader>
  )

  if (loading) {
    return (
      <ModalSheet title="Deals" wide>
        <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
          <View style={styles.loadingContent}>
            <ScreenHeader
              style={styles.headerFlush}
              title={isWide ? '' : 'Deals'}
              onBack={isWide ? undefined : () => router.back()}
            />
            <SkeletonList count={6} />
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="Deals" wide>
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <FlatList
        data={isDesktop ? [] : visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <DealRow
            deal={item}
            index={index}
            variant="plain"
            onPress={() => router.push(`/(app)/deal/${item.id}` as never)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          visible.length === 0 ? (
            <EmptyState
              icon={query || filter !== 'all' ? 'search-outline' : 'sparkles'}
              title={query || filter !== 'all' ? 'Nothing here' : 'No deals yet'}
              message={
                query || filter !== 'all'
                  ? 'Nothing matches that search or filter.'
                  : 'Screenshot a brand DM, talk it out, or type it in.'
              }
              actionLabel={query || filter !== 'all' ? undefined : 'Add your first deal'}
              onAction={
                query || filter !== 'all'
                  ? undefined
                  : () => router.push('/(app)/deal/new' as never)
              }
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={c.textMuted}
            colors={[c.accent]}
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  loadingContent: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerFlush: {
    paddingHorizontal: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  brandCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
  brandName: {
    ...Typography.body,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  cellMuted: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  cellAmount: {
    ...Typography.body,
    fontFamily: FontFamily.semiBold,
    fontVariant: ['tabular-nums'],
  },
})
