import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { useRouter } from 'expo-router'
import { getBrands } from '@/lib/brands'
import { getAllRatings, summarizeRatings } from '@/lib/reputation'
import type { Brand, BrandRating } from '@/types'
import { DesktopContentMaxWidth, FontFamily, Spacing, Typography } from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { BrandAvatar } from '@/components/BrandAvatar'
import {
  EmptyState,
  HeaderUtilities,
  ListRow,
  ScreenHeader,
  SkeletonList,
  StarRating,
  StatTile,
  TextField,
  useToast,
} from '@/components/ui'

export default function BrandsScreen() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [brands, setBrands] = useState<Brand[]>([])
  const [ratings, setRatings] = useState<BrandRating[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')

  // Fetched independently — ratings depend on migration 006 (a newer,
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
      [brand.name, brand.contact_person, brand.contact_email]
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
        <StatTile label="On file" value={brands.length} caption="brands added" index={0} />
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
          label="Average score"
          value={averageRating ?? 0}
          format={(value) => (averageRating == null ? '—' : `${value.toFixed(1)}`)}
          caption="out of 5"
          index={2}
        />
      </View>

      {/* Always visible, not gated on a brand count — a search field that
          appears at four rows means the control moves as the list grows. */}
      <TextField
        placeholder="Search brands"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
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
        numColumns={isDesktop ? 2 : 1}
        columnWrapperStyle={isDesktop ? styles.column : undefined}
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const summary = summarizeRatings(ratingsByBrand.get(item.id) ?? [])
          // POC — the brand-side person the creator actually deals with.
          const poc = [item.contact_person, item.contact_email].filter(Boolean).join(' · ')

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
