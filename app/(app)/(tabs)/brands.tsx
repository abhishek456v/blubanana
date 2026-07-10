import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { getBrands } from '@/lib/brands'
import type { Brand } from '@/types'
import { BrandAvatar } from '@/components/BrandAvatar'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'

function BrandRow({ brand }: { brand: Brand }) {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light

  const subtitle = [brand.contact_person, brand.contact_email]
    .filter(Boolean)
    .join(' · ')

  return (
    <View style={[styles.row, { backgroundColor: c.bgSurface }]}>
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
    </View>
  )
}

export default function BrandsScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light

  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBrands = useCallback(async () => {
    try {
      const data = await getBrands()
      setBrands(data)
    } catch {
      Alert.alert('Error', 'Could not load brands.')
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
        renderItem={({ item }) => <BrandRow brand={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.list}
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
