import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { getInvoices } from '@/lib/invoices'
import { formatCurrency, formatDate, financialYearOf, parseLocalDate } from '@/lib/format'
import type { Invoice } from '@/types'
import { ContentMaxWidth, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  DataTable,
  EmptyState,
  ListRow,
  SkeletonList,
  useToast,
  type DataTableColumn,
} from '@/components/ui'

export default function InvoicesScreen() {
  const toast = useToast()
  const { c } = useTheme()
  const { isWide, isDesktop } = useBreakpoint()
  const router = useRouter()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setInvoices(await getInvoices())
    } catch {
      toast('Could not load invoices', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  // Totals for the current financial year: the figure that matters when
  // reconciling against what was actually billed.
  const summary = useMemo(() => {
    const currentFy = financialYearOf()
    const thisYear = invoices.filter(
      (invoice) => financialYearOf(parseLocalDate(invoice.invoice_date)) === currentFy
    )
    return {
      fy: currentFy,
      count: thisYear.length,
      billed: thisYear.reduce((sum, invoice) => sum + invoice.total_amount, 0),
    }
  }, [invoices])

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'number', title: 'Invoice', flex: 1.2, render: (row) => row.invoice_number },
    { key: 'brand', title: 'Brand', flex: 1.4, render: (row) => row.brand_name },
    { key: 'date', title: 'Date', render: (row) => formatDate(row.invoice_date) },
    { key: 'gst', title: 'GST', render: (row) => (row.gst_applicable ? '18%' : '—') },
    {
      key: 'amount',
      title: 'Amount',
      align: 'right',
      render: (row) => (
        <Text style={[styles.amount, { color: c.textPrimary }]}>
          {formatCurrency(row.total_amount)}
        </Text>
      ),
    },
  ]

  return (
    <ModalSheet title="Invoices">
      <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        {loading ? (
          <View style={[styles.list, isWide && styles.listWide]}>
            <SkeletonList count={4} />
          </View>
        ) : isDesktop && invoices.length > 0 ? (
          // Desktop gets a real table (DESIGN.md §8: tables are a desktop
          // affordance). Aligned rupee and date columns scan; phones keep the
          // ListRow layout below.
          <FlatList
            data={[0]}
            keyExtractor={() => 'table'}
            renderItem={() => (
              <DataTable
                columns={columns}
                rows={invoices}
                keyOf={(row) => row.id}
                onRowPress={(row) => router.push(`/(app)/invoice/${row.id}` as never)}
              />
            )}
            ListHeaderComponent={
              summary.count > 0 ? (
                <View style={[styles.summary, { backgroundColor: c.bgSurface }]}>
                  <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>
                    Billed in FY {summary.fy}
                  </Text>
                  <Text style={[styles.summaryValue, { color: c.textPrimary }]}>
                    {formatCurrency(summary.billed)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: c.textMuted }]}>
                    across {summary.count} {summary.count === 1 ? 'invoice' : 'invoices'}
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={[styles.list, styles.listWide]}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ListRow
                title={item.invoice_number}
                subtitle={item.brand_name}
                meta={formatDate(item.invoice_date)}
                leading={
                  <View style={[styles.icon, { backgroundColor: c.accentLight }]}>
                    <Ionicons name="document-text" size={17} color={c.accent} />
                  </View>
                }
                trailing={
                  <View style={styles.amountBlock}>
                    <Text style={[styles.amount, { color: c.textPrimary }]}>
                      {formatCurrency(item.total_amount)}
                    </Text>
                    {item.gst_applicable ? (
                      <Text style={[styles.amountNote, { color: c.textMuted }]}>incl. GST</Text>
                    ) : null}
                  </View>
                }
                index={index}
                onPress={() => router.push(`/(app)/invoice/${item.id}` as never)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              summary.count > 0 ? (
                <View style={[styles.summary, { backgroundColor: c.bgSurface }]}>
                  <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>
                    Billed in FY {summary.fy}
                  </Text>
                  <Text style={[styles.summaryValue, { color: c.textPrimary }]}>
                    {formatCurrency(summary.billed)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: c.textMuted }]}>
                    across {summary.count} {summary.count === 1 ? 'invoice' : 'invoices'}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="document-text-outline"
                title="No invoices yet"
                message="Open any deal and tap Create invoice. The brand's details, the amount and the GST are filled in for you."
              />
            }
            contentContainerStyle={[styles.list, isWide && styles.listWide]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </ModalSheet>
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
  separator: {
    height: 10,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  amount: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.display,
  },
  amountNote: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  summary: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 1,
  },
  summaryLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  summaryValue: {
    ...Typography.display,
    fontFamily: FontFamily.display,
  },
})
