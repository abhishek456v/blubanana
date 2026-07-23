import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native'
import { showAlert } from '@/lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { useRouter } from 'expo-router'
import { getBrands } from '@/lib/brands'
import { getAllRatings, summarizeRatings } from '@/lib/reputation'
import type { Brand, BrandRating } from '@/types'
import { BrandAvatar } from '@/components/BrandAvatar'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

function BrandRow({
  brand,
  ratings,
  onPress,
}: {
  brand: Brand
  ratings: BrandRating[]
  onPress: () => void
}) {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const summary = summarizeRatings(ratings)

  const subtitle = [brand.contact_person, brand.contact_email]
    .filter(Boolean)
    .join(' · ')

  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: c.bgSurface }]} onPress={onPress} activeOpacity={0.75}>
      <BrandAvatar name={brand.name} size={36} />
      <View style={styles.rowText}>
        <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
          {brand.name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {summary ? (
        <View style={[styles.ratingPill, { backgroundColor: c.accentLight }]}>
          <Text style={[styles.ratingPillText, { color: c.accent }]}>{summary.averageRating.toFixed(1)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

export default function BrandsScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()
  const router = useRouter()

  const [brands, setBrands] = useState<Brand[]>([])
  const [ratings, setRatings] = useState<BrandRating[]>([])
  const [loading, setLoading] = useState(true)

  // Fetched independently — ratings depends on migration 006 (a newer,
  // separate table), so it being unavailable shouldn't block the brand list
  // itself, which has worked since migration 001.
  const fetchBrands = useCallback(async () => {
    try {
      setBrands(await getBrands())
    } catch {
      showAlert('Error', 'Could not load brands.')
    }
    try {
      setRatings(await getAllRatings())
    } catch {
      // Non-fatal: rows just render without a rating badge until this succeeds.
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchBrands()
    }, [fetchBrands])
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
        data={brands}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BrandRow
            brand={item}
            ratings={ratings.filter((r) => r.brand_id === item.id)}
            onPress={() => router.push(`/(app)/brand/${item.id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={[styles.list, isWide && styles.listWide]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>No brands yet</Text>
            <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
              Tap "Add brand" above to log your first client.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  listWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  subtitle: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  ratingPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  ratingPillText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
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
