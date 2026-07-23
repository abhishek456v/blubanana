import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native'
import { showAlert } from '@/lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { computeRevenueSummary } from '@/lib/revenue'
import { getInvoices } from '@/lib/invoices'
import type { Invoice } from '@/types'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export default function RevenueScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()
  const router = useRouter()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  // Fetched independently, not Promise.all — invoices depends on migration
  // 006 (a newer, separate table from deals/payments), so one being
  // unavailable shouldn't blank out the revenue stats the other half can
  // still compute.
  const load = useCallback(async () => {
    try {
      setDeals(await getDeals())
    } catch {
      showAlert('Error', 'Could not load deals.')
    }
    try {
      setInvoices(await getInvoices())
    } catch {
      // Non-fatal: invoices section just shows zero until this succeeds.
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={c.textMuted} />
      </SafeAreaView>
    )
  }

  const summary = computeRevenueSummary(deals)
  const maxMonthTotal = Math.max(1, ...summary.monthlyTotals.map((m) => m.total))

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Earned this month</Text>
            <Text style={[styles.statValue, { color: c.textPrimary }]}>{formatINR(summary.earnedThisMonth)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Pending payment</Text>
            <Text style={[styles.statValue, { color: c.warning }]}>{formatINR(summary.pendingPayment)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Avg. deal value</Text>
            <Text style={[styles.statValue, { color: c.textPrimary }]}>{formatINR(summary.averageDealValue)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Deals closed</Text>
            <Text style={[styles.statValue, { color: c.textPrimary }]}>{summary.dealsClosed}</Text>
          </View>
        </View>

        {summary.bestPayingBrand ? (
          <View style={[styles.bestBrandCard, { backgroundColor: c.accentLight }]}>
            <Text style={[styles.bestBrandLabel, { color: c.textSecondary }]}>Best-paying brand</Text>
            <Text style={[styles.bestBrandValue, { color: c.accent }]}>
              {summary.bestPayingBrand.name} · {formatINR(summary.bestPayingBrand.total)}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Last 6 months</Text>
        <View style={[styles.chartCard, { backgroundColor: c.bgSurface }]}>
          <View style={styles.chartRow}>
            {summary.monthlyTotals.map((m) => (
              <View key={m.label} style={styles.chartBarWrap}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: Math.max(4, (m.total / maxMonthTotal) * 100),
                      backgroundColor: c.accent,
                    },
                  ]}
                />
                <Text style={[styles.chartBarLabel, { color: c.textMuted }]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity
            style={[styles.linkCard, { backgroundColor: c.bgSurface }]}
            onPress={() => router.push('/(app)/invoices' as never)}
            activeOpacity={0.75}
          >
            <Text style={[styles.linkTitle, { color: c.textPrimary }]}>Invoices</Text>
            <Text style={[styles.linkSubtitle, { color: c.textMuted }]}>
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'} created
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkCard, { backgroundColor: c.bgSurface }]}
            onPress={() => router.push('/(app)/annual-report' as never)}
            activeOpacity={0.75}
          >
            <Text style={[styles.linkTitle, { color: c.textPrimary }]}>Annual report</Text>
            <Text style={[styles.linkSubtitle, { color: c.textMuted }]}>Full-year summary</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  contentWide: { maxWidth: ContentMaxWidth, width: '100%', alignSelf: 'center' },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  statLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: FontFamily.display,
    fontSize: 22,
  },
  bestBrandCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  bestBrandLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  bestBrandValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  chartCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: Spacing.sm,
  },
  chartBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    gap: 6,
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
  },
  chartBarLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
  linkRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  linkCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  linkTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  linkSubtitle: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
})
