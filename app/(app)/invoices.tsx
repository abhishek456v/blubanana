import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native'
import { showAlert } from '@/lib/alert'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { getInvoices } from '@/lib/invoices'
import type { Invoice } from '@/types'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function InvoicesScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()
  const router = useRouter()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setInvoices(await getInvoices())
    } catch {
      showAlert('Error', 'Could not load invoices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  return (
    <ModalSheet title="Invoices">
      <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={c.textMuted} />
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: c.bgSurface }]}
                onPress={() => router.push(`/(app)/invoice/${item.id}` as never)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.invNumber, { color: c.textPrimary }]}>{item.invoice_number}</Text>
                  <Text style={[styles.invMeta, { color: c.textMuted }]} numberOfLines={1}>
                    {item.brand_name} · {formatDate(item.invoice_date)}
                  </Text>
                </View>
                <Text style={[styles.invAmount, { color: c.textPrimary }]}>{formatINR(item.total_amount)}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={[styles.list, isWide && styles.listWide]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>No invoices yet</Text>
                <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
                  Create one from any deal's page.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  listWide: { maxWidth: ContentMaxWidth, width: '100%', alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  invNumber: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  invMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  invAmount: {
    ...Typography.bodyStrong,
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
  },
})
