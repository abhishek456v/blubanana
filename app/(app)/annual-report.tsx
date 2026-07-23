import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native'
import { showAlert } from '@/lib/alert'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { getInvoices } from '@/lib/invoices'
import { getAllRatings } from '@/lib/reputation'
import { computeAnnualReport, currentFinancialYearStart } from '@/lib/annualReport'
import type { Invoice, BrandRating } from '@/types'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export default function AnnualReportScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [ratings, setRatings] = useState<BrandRating[]>([])
  const [loading, setLoading] = useState(true)
  const [fyStartYear, setFyStartYear] = useState(currentFinancialYearStart())

  // Fetched independently — invoices/ratings depend on migration 006 (newer,
  // separate tables), so either being unavailable shouldn't block the
  // deal-based numbers, which have worked since migration 001.
  const load = useCallback(async () => {
    try {
      setDeals(await getDeals())
    } catch {
      showAlert('Error', 'Could not load deals.')
    }
    try {
      setInvoices(await getInvoices())
    } catch {
      // Non-fatal: tax summary just shows zero until this succeeds.
    }
    try {
      setRatings(await getAllRatings())
    } catch {
      // Non-fatal: lowest-rated client just doesn't show until this succeeds.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <ModalSheet title="Annual report">
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <ActivityIndicator color={c.textMuted} />
        </SafeAreaView>
      </ModalSheet>
    )
  }

  const report = computeAnnualReport(deals, invoices, ratings, fyStartYear)

  return (
    <ModalSheet title="Annual report">
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={[styles.content, isWide && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.yearRow}>
            <TouchableOpacity onPress={() => setFyStartYear((y) => y - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.yearLabel, { color: c.textPrimary }]}>{report.fyLabel}</Text>
            <TouchableOpacity
              onPress={() => setFyStartYear((y) => Math.min(currentFinancialYearStart(), y + 1))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.heroCard, { backgroundColor: c.accentLight }]}>
            <Text style={[styles.heroLabel, { color: c.textSecondary }]}>Total revenue</Text>
            <Text style={[styles.heroValue, { color: c.accent }]}>{formatINR(report.totalRevenue)}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>Deals closed</Text>
              <Text style={[styles.statValue, { color: c.textPrimary }]}>{report.dealsClosed}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>Payments resolved</Text>
              <Text style={[styles.statValue, { color: c.textPrimary }]}>{report.paymentsResolved}</Text>
            </View>
          </View>

          {report.bestClient ? (
            <View style={[styles.rowCard, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.rowLabel, { color: c.textSecondary }]}>Best client</Text>
              <Text style={[styles.rowValue, { color: c.textPrimary }]}>
                {report.bestClient.name} · {formatINR(report.bestClient.total)}
              </Text>
            </View>
          ) : null}

          {report.worstClient ? (
            <View style={[styles.rowCard, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.rowLabel, { color: c.textSecondary }]}>Lowest-rated client</Text>
              <Text style={[styles.rowValue, { color: c.textPrimary }]}>
                {report.worstClient.name} · {report.worstClient.averageRating.toFixed(1)}/5
              </Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Tax summary</Text>
          <View style={[styles.rowCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.rowLabel, { color: c.textSecondary }]}>GST collected</Text>
            <Text style={[styles.rowValue, { color: c.textPrimary }]}>{formatINR(report.gstCollected)}</Text>
          </View>
          <View style={[styles.rowCard, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.rowLabel, { color: c.textSecondary }]}>TDS deducted</Text>
            <Text style={[styles.rowValue, { color: c.textPrimary }]}>{formatINR(report.tdsDeducted)}</Text>
          </View>

          {deals.length === 0 ? (
            <Text style={[styles.emptyNote, { color: c.textMuted }]}>
              No deal data yet — this fills in as you log and complete deals.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  contentWide: { maxWidth: ContentMaxWidth, width: '100%', alignSelf: 'center' },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  yearLabel: {
    fontFamily: FontFamily.display,
    fontSize: 18,
  },
  heroCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  heroLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  heroValue: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  statLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  statValue: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    marginTop: 2,
  },
  rowCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  rowValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  sectionTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    marginTop: Spacing.md,
  },
  emptyNote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
})
