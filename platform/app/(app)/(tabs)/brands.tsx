import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { useRouter } from 'expo-router'
import { brandContact, getBrands } from '@/lib/brands'
import { getDeals, paymentsInOrder, type DealWithPaymentSummary } from '@/lib/deals'
import { getAllRatings, summarizeRatings } from '@/lib/reputation'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/format'
import type { Brand, BrandRating } from '@/types'
import {
  ColumnGap,
  DesktopContentMaxWidth,
  FontFamily,
  Spacing,
  Typography,
} from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { BrandAvatar } from '@/components/BrandAvatar'
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  HeaderUtilities,
  HeroCard,
  ListRow,
  Panel,
  ScreenHeader,
  SkeletonList,
  StarRating,
  StatTile,
  TextField,
  useToast,
  ViewAllLink,
} from '@/components/ui'

export default function BrandsScreen() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [brands, setBrands] = useState<Brand[]>([])
  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [ratings, setRatings] = useState<BrandRating[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [showAllBrands, setShowAllBrands] = useState(false)

  // Fetched independently: ratings depend on migration 006 (a newer,
  // separate table), so that being unavailable shouldn't block the brand list
  // itself, which has worked since migration 001.
  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        setBrands(await getBrands())
      } catch {
        toast('Could not load your brands', { tone: 'error' })
      }
      try {
        setRatings(await getAllRatings())
      } catch {
        // Non-fatal: rows render without a rating until this succeeds.
      }
      try {
        // What each brand has actually paid, for the ranking and the table.
        // Independent of the brand list: a brand with no deals is still a
        // brand, and should not vanish because this call failed.
        setDeals(await getDeals())
      } catch {
        // Non-fatal: the money columns read zero until this succeeds.
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

  const ratingsByBrand = useMemo(() => {
    const map = new Map<string, BrandRating[]>()
    for (const rating of ratings) {
      const existing = map.get(rating.brand_id)
      if (existing) existing.push(rating)
      else map.set(rating.brand_id, [rating])
    }
    return map
  }, [ratings])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return brands
    return brands.filter((brand) =>
      [brand.name, brandContact(brand)?.name, brandContact(brand)?.email]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle))
    )
  }, [brands, query])

  const rated = brands.filter((brand) => (ratingsByBrand.get(brand.id) ?? []).length > 0)
  const averageRating =
    rated.length > 0
      ? rated.reduce(
          (sum, brand) => sum + (summarizeRatings(ratingsByBrand.get(brand.id)!)?.averageRating ?? 0),
          0
        ) / rated.length
      : null

  /**
   * Per-brand money and activity, keyed by brand id.
   *
   * Totals count what actually *arrived*, not what was agreed: a brand that
   * signed a large deal and has not paid it has not earned a ranking, which
   * is the same rule Home's figures use.
   */
  const byBrand = useMemo(() => {
    const map = new Map<string, { paid: number; deals: number; last: string | null }>()

    for (const deal of deals) {
      const id = deal.brand?.id
      if (!id) continue
      const entry = map.get(id) ?? { paid: 0, deals: 0, last: null }
      entry.deals += 1

      for (const payment of paymentsInOrder(deal)) {
        if (payment.status === 'paid') {
          entry.paid += payment.amount_received ?? payment.amount
          if (payment.paid_date && (!entry.last || payment.paid_date > entry.last)) {
            entry.last = payment.paid_date
          }
        }
      }
      map.set(id, entry)
    }
    return map
  }, [deals])

  /** Top three by what they have paid, for the hero's ranking. */
  const ranking = useMemo(() => {
    return brands
      .map((brand) => ({ brand, paid: byBrand.get(brand.id)?.paid ?? 0 }))
      .filter((row) => row.paid > 0)
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 3)
  }, [brands, byBrand])

  const topPaid = ranking[0]?.paid ?? 0
  const totalPaid = useMemo(
    () => [...byBrand.values()].reduce((sum, entry) => sum + entry.paid, 0),
    [byBrand]
  )
  const repeatBrands = useMemo(
    () => [...byBrand.values()].filter((entry) => entry.deals > 1).length,
    [byBrand]
  )

  const brandColumns: DataTableColumn<Brand>[] = [
    {
      key: 'brand',
      title: 'Brand',
      flex: 2,
      render: (brand) => (
        <View style={styles.brandCell}>
          <BrandAvatar name={brand.name} size={26} />
          <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
            {brand.name}
          </Text>
        </View>
      ),
    },
    {
      key: 'contact',
      title: 'Contact',
      flex: 1.9,
      render: (brand) => (
        <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
          {[brandContact(brand)?.name, brandContact(brand)?.email]
            .filter(Boolean)
            .join(' · ') || 'No POC yet'}
        </Text>
      ),
    },
    {
      key: 'paid',
      title: 'Paid, all time',
      flex: 1.1,
      align: 'right',
      render: (brand) => (
        <Text style={[styles.cellAmount, { color: c.textPrimary }]} numberOfLines={1}>
          {formatCurrency(byBrand.get(brand.id)?.paid ?? 0)}
        </Text>
      ),
    },
    {
      key: 'deals',
      title: 'Deals',
      flex: 0.6,
      align: 'right',
      render: (brand) => (
        <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
          {byBrand.get(brand.id)?.deals ?? 0}
        </Text>
      ),
    },
    {
      key: 'last',
      title: 'Last paid',
      flex: 0.9,
      align: 'right',
      render: (brand) => {
        const last = byBrand.get(brand.id)?.last
        return (
          <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
            {last ? formatDate(last) : '—'}
          </Text>
        )
      },
    },
  ]

  const header = (
    <ScreenHeader
      style={styles.headerFlush}
      title="Brands"
      subtitle="Who you have worked with, and how they behaved."
      leadingAction={<HeaderUtilities showSearch={false} />}
      actions={[
        {
          icon: 'add',
          label: 'Add brand',
          primary: true,
          onPress: () => router.push('/(app)/brand/new' as never),
        },
      ]}
    >
      <View style={styles.tiles}>
        <StatTile
          dense={isDesktop}
          label="On file"
          value={brands.length}
          caption="brands added"
          index={0}
        />
        <StatTile
          label="Rated"
          value={rated.length}
          caption={
            rated.length === brands.length && brands.length > 0
              ? 'every one scored'
              : `${brands.length - rated.length} still unscored`
          }
          index={1}
        />
        <StatTile
          dense={isDesktop}
          label="Average score"
          value={averageRating ?? 0}
          format={(value) => (averageRating == null ? '—' : `${value.toFixed(1)}`)}
          caption="out of 5"
          index={2}
        />
        {/* Four, not three: on a phone three tiles wrap 2 + 1 and the last
            one stretches to full width, which reads as a mistake. Four make
            a square there and a strip on desktop. */}
        <StatTile
          dense={isDesktop}
          label="Came back"
          value={repeatBrands}
          caption={repeatBrands === 1 ? 'brand with more than one deal' : 'brands with more than one deal'}
          index={3}
        />
      </View>

      {/* Always visible, not gated on a brand count: a search field that
          appears at four rows means the control moves as the list grows. */}
      <TextField
        placeholder="Search brands"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {isDesktop ? (
        <View style={styles.mainRow}>
          <HeroCard
            label="Top brands, all time"
            value={totalPaid}
            format={formatCurrency}
            caption={`paid across ${brands.length} ${brands.length === 1 ? 'brand' : 'brands'}`}
            gradient="ink"
            style={styles.heroCell}
            chart={
              ranking.length > 0 ? (
                <View style={styles.ranking}>
                  {ranking.map((row, index) => (
                    <View key={row.brand.id} style={styles.rankRow}>
                      <Text style={styles.rankNumber}>{index + 1}</Text>
                      <View style={styles.rankBody}>
                        <View style={styles.rankLine}>
                          <Text style={styles.rankName} numberOfLines={1}>
                            {row.brand.name}
                          </Text>
                          <Text style={styles.rankValue}>
                            {formatCurrencyCompact(row.paid)}
                          </Text>
                        </View>
                        {/* Bar widths are relative to the top payer, so the
                            leader always fills the row and the rest are read
                            against it. */}
                        <View
                          style={[
                            styles.rankBar,
                            {
                              width: `${topPaid > 0 ? Math.max((row.paid / topPaid) * 100, 6) : 0}%`,
                              opacity: 1 - index * 0.22,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : undefined
            }
          />

          <Panel
            title="All brands"
            count={visible.length}
            fill
            action={
              visible.length > 6 ? (
                <ViewAllLink
                  label={showAllBrands ? 'Show fewer' : `View all ${visible.length}`}
                  onPress={() => setShowAllBrands((current) => !current)}
                />
              ) : undefined
            }
          >
            {visible.length > 0 ? (
              <DataTable
                columns={brandColumns}
                rows={showAllBrands ? visible : visible.slice(0, 6)}
                keyOf={(brand) => brand.id}
                onRowPress={(brand) => router.push(`/(app)/brand/${brand.id}` as never)}
              />
            ) : (
              <Text style={[styles.cellMuted, { color: c.textMuted }]}>
                {query ? 'Nothing matches that search.' : 'No brands yet.'}
              </Text>
            )}
          </Panel>
        </View>
      ) : null}

    </ScreenHeader>
  )

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
        <View style={styles.loadingContent}>
          <ScreenHeader style={styles.headerFlush} title="Brands" />
          <SkeletonList count={5} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <FlatList
        // numColumns is fixed for the life of a FlatList, so the key forces a
        // remount when the window crosses the desktop breakpoint.
        key={isDesktop ? 'grid' : 'list'}
        numColumns={1}
        // Desktop renders the brands as a table inside the header, so the
        // list itself carries nothing there; the phone keeps the rows.
        data={isDesktop ? [] : visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const summary = summarizeRatings(ratingsByBrand.get(item.id) ?? [])
          // POC: the brand-side person the creator actually deals with.
          const poc = [brandContact(item)?.name, brandContact(item)?.email]
            .filter(Boolean)
            .join(' · ')

          return (
            <View style={isDesktop ? styles.gridCell : undefined}>
            <ListRow
              title={item.name}
              subtitle={poc || 'No POC yet'}
              leading={<BrandAvatar name={item.name} size={38} />}
              trailing={
                summary ? (
                  <View style={styles.rating}>
                    <StarRating value={Math.round(summary.averageRating)} size={13} readonly />
                    <Text style={[styles.ratingValue, { color: c.textSecondary }]}>
                      {summary.averageRating.toFixed(1)}
                    </Text>
                  </View>
                ) : undefined
              }
              showChevron={!summary}
              index={index}
              onPress={() => router.push(`/(app)/brand/${item.id}` as never)}
            />
            </View>
          )
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isDesktop ? null : (
          <EmptyState
            icon={query ? 'search-outline' : 'people-outline'}
            title={query ? 'No match' : 'No brands yet'}
            message={
              query
                ? 'Nothing matches that search.'
                : 'Every brand you add builds a private record: how fast they paid, how many revisions they asked for, whether you would work with them again.'
            }
            actionLabel={query ? undefined : 'Add your first brand'}
            onAction={query ? undefined : () => router.push('/(app)/brand/new' as never)}
          />
          )
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
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  column: {
    gap: Spacing.base,
  },
  gridCell: {
    flex: 1,
  },

  // ── The desktop dashboard (Phase 3) ──────────────────────────────────
  mainRow: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
  },
  heroCell: {
    flex: 1.1,
  },
  ranking: {
    gap: Spacing.base,
    marginTop: Spacing.sm,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  rankNumber: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255,255,255,0.6)',
    width: 12,
  },
  rankBody: {
    flex: 1,
    gap: 5,
  },
  rankLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rankName: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  rankValue: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  rankBar: {
    height: 5,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
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
  separator: {
    height: 10,
  },
  rating: {
    alignItems: 'flex-end',
    gap: 3,
  },
  ratingValue: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
})
