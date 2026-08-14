import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getInvoice, getInvoiceLineItems } from '@/lib/invoices'
import { getProfile } from '@/lib/profile'
import { buildInvoiceHtml } from '@/lib/invoiceHtml'
import { shareInvoicePdf } from '@/lib/invoicePdf'
import type { Creator, Invoice, InvoiceLineItem } from '@/types'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'
import { useToast } from '@/components/ui'

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InvoiceDetailScreen() {
  const toast = useToast()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [creator, setCreator] = useState<Creator | null>(null)
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    Promise.all([getInvoice(id), getProfile()])
      .then(([inv, profile]) => {
        if (!active) return
        setInvoice(inv)
        setCreator(profile)
      })
      .catch(() => toast('Could not load this invoice', { tone: 'error' }))
      .finally(() => active && setLoading(false))

    // Fetched separately — invoice_line_items arrived in migration 008, so an
    // older invoice (or an un-migrated database) simply has none, and
    // buildInvoiceHtml falls back to the invoice's own description/amount.
    getInvoiceLineItems(id)
      .then((items) => active && setLineItems(items))
      .catch(() => {})

    return () => {
      active = false
    }
  }, [id, toast])

  async function handleShare() {
    if (!invoice || !creator || sharing) return
    setSharing(true)
    try {
      await shareInvoicePdf(
        buildInvoiceHtml(invoice, creator, lineItems),
        invoice.invoice_number
      )
    } catch {
      toast('Could not export the PDF', { tone: 'error' })
    } finally {
      setSharing(false)
    }
  }

  if (loading || !invoice || !creator) {
    return (
      <ModalSheet title="Invoice">
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <ActivityIndicator color={c.textMuted} />
        </SafeAreaView>
      </ModalSheet>
    )
  }

  const netDue = invoice.total_amount - (invoice.tds_deducted ? invoice.tds_amount ?? 0 : 0)

  return (
    <ModalSheet title={invoice.invoice_number}>
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={[styles.content, isWide && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.preview, { backgroundColor: c.bgSurfaceRaised, borderColor: c.border }]}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fromName, { color: c.textPrimary }]}>{creator.name}</Text>
                <Text style={[styles.fromMeta, { color: c.textSecondary }]}>Content Creator</Text>
                {creator.phone ? <Text style={[styles.fromMeta, { color: c.textSecondary }]}>{creator.phone}</Text> : null}
                {creator.gstin ? <Text style={[styles.fromMeta, { color: c.textSecondary }]}>GSTIN: {creator.gstin}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.invLabel, { color: c.textMuted }]}>Invoice</Text>
                <Text style={[styles.invNumber, { color: c.textPrimary }]}>{invoice.invoice_number}</Text>
                <Text style={[styles.fromMeta, { color: c.textSecondary }]}>{formatDate(invoice.invoice_date)}</Text>
              </View>
            </View>

            <View style={[styles.billTo, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.invLabel, { color: c.textMuted }]}>Bill to</Text>
              <Text style={[styles.billToName, { color: c.textPrimary }]}>{invoice.brand_name}</Text>
              {invoice.brand_contact_person || invoice.brand_contact_email ? (
                <Text style={[styles.fromMeta, { color: c.textSecondary }]}>
                  {[invoice.brand_contact_person, invoice.brand_contact_email].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>

            <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: c.border }]}>
              <Text style={[styles.tableHeaderText, { color: c.textMuted }]}>Description</Text>
              <Text style={[styles.tableHeaderText, { color: c.textMuted }]}>Amount</Text>
            </View>
            {/* One row per billed line, so a consolidated invoice reads on
                screen exactly as it will print. Pre-migration-008 invoices
                have no line items and fall back to their own description. */}
            {lineItems.length > 0 ? (
              lineItems.map((item) => (
                <View key={item.id} style={[styles.tableRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.tableCell, { color: c.textPrimary, flex: 1 }]}>
                    {item.quantity > 1 ? `${item.description} ×${item.quantity}` : item.description}
                  </Text>
                  <Text style={[styles.tableCell, { color: c.textPrimary }]}>
                    {formatINR(item.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={[styles.tableRow, { borderBottomColor: c.border }]}>
                <Text style={[styles.tableCell, { color: c.textPrimary, flex: 1 }]}>
                  {invoice.description}
                </Text>
                <Text style={[styles.tableCell, { color: c.textPrimary }]}>
                  {formatINR(invoice.amount)}
                </Text>
              </View>
            )}

            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: c.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.totalValue, { color: c.textSecondary }]}>{formatINR(invoice.amount)}</Text>
              </View>
              {invoice.gst_applicable ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: c.textSecondary }]}>GST ({invoice.gst_rate}%)</Text>
                  <Text style={[styles.totalValue, { color: c.textSecondary }]}>{formatINR(invoice.gst_amount)}</Text>
                </View>
              ) : null}
              {invoice.tds_deducted && invoice.tds_amount ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: c.textSecondary }]}>TDS deducted</Text>
                  <Text style={[styles.totalValue, { color: c.textSecondary }]}>-{formatINR(invoice.tds_amount)}</Text>
                </View>
              ) : null}
              <View style={[styles.totalRow, styles.finalRow, { borderTopColor: c.border }]}>
                <Text style={[styles.finalLabel, { color: c.textPrimary }]}>Total due</Text>
                <Text style={[styles.finalValue, { color: c.accent }]}>{formatINR(netDue)}</Text>
              </View>
            </View>

            {creator.upi_id || creator.bank_account_number || invoice.payment_due_date ? (
              <View style={[styles.paymentDetails, { borderTopColor: c.border }]}>
                <Text style={[styles.paymentDetailsTitle, { color: c.textPrimary }]}>Payment details</Text>
                {creator.upi_id ? <Text style={[styles.fromMeta, { color: c.textSecondary }]}>UPI: {creator.upi_id}</Text> : null}
                {creator.bank_account_number ? (
                  <Text style={[styles.fromMeta, { color: c.textSecondary }]}>Account: {creator.bank_account_number}</Text>
                ) : null}
                {invoice.payment_due_date ? (
                  <Text style={[styles.fromMeta, { color: c.textSecondary }]}>Due: {formatDate(invoice.payment_due_date)}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.8}
          >
            {sharing ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.shareButtonText, { color: c.onFillPrimary }]}>
                {Platform.OS === 'web' ? 'Print / Save as PDF' : 'Share PDF'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  contentWide: { maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  fromName: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  fromMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  invLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
  invNumber: {
    fontFamily: FontFamily.display,
    fontSize: 18,
  },
  billTo: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  billToName: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  tableHeader: {},
  tableHeaderText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tableCell: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  totalsBlock: {
    marginTop: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  totalValue: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  finalRow: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: Spacing.sm,
  },
  finalLabel: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  finalValue: {
    fontFamily: FontFamily.display,
    fontSize: 18,
  },
  paymentDetails: {
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    gap: 2,
  },
  paymentDetailsTitle: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginBottom: 2,
  },
  shareButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  shareButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
