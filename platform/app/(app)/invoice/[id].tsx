import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getInvoice, getInvoiceLineItems } from '@/lib/invoices'
import { getProfile } from '@/lib/profile'
import { buildInvoiceHtml } from '@/lib/invoiceHtml'
import { sharePdf } from '@/lib/sharePdf'
import { getDeal } from '@/lib/deals'
import { getContacts, primaryContact } from '@/lib/brandContacts'
import { sendNow } from '@/lib/messaging'
import { buildInvoiceMessage } from '@/lib/whatsapp'
import { isValidUpiId } from '@/lib/upi'
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
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

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

    // Fetched separately: invoice_line_items arrived in migration 008, so an
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
      await sharePdf(
        buildInvoiceHtml(invoice, creator, lineItems),
        invoice.invoice_number
      )
    } catch {
      toast('Could not export the PDF', { tone: 'error' })
    } finally {
      setSharing(false)
    }
  }

  /**
   * Hands the invoice to WhatsApp, addressed to the brand's primary contact.
   *
   * The contact is looked up here rather than held in state because it is only
   * needed on this tap: loading it on mount would put two more queries on the
   * path of a screen most often opened just to look at the invoice.
   *
   * The PDF is not attached — a wa.me link carries text only (see
   * buildInvoiceMessage). The message says the PDF is coming, and the Share
   * button below it is how she sends it, into the chat this just opened.
   */
  async function handleSendOnWhatsApp() {
    if (!invoice || !creator || sendingWhatsApp) return
    if (!invoice.deal_id) {
      toast('This invoice is not linked to a deal, so there is no contact to send it to', {
        tone: 'warning',
      })
      return
    }

    setSendingWhatsApp(true)
    try {
      const deal = await getDeal(invoice.deal_id)
      const contacts = await getContacts(deal.brand_id)
      const contact = primaryContact(contacts)
      const phone = contact?.phone ?? null

      if (!phone) {
        toast(`No WhatsApp number saved for ${invoice.brand_name}`, { tone: 'warning' })
        return
      }

      const netPayable =
        invoice.total_amount - (invoice.tds_deducted ? (invoice.tds_amount ?? 0) : 0)

      const body = buildInvoiceMessage({
        brandName: invoice.brand_name,
        contactPerson: contact?.name ?? null,
        invoiceNumber: invoice.invoice_number,
        amount: netPayable,
        dueDate: invoice.payment_due_date,
        hasUpiQr: isValidUpiId(creator.upi_id),
      })

      // Logged to the deal's message history, like every other outbound
      // message: "did I ever actually send that invoice" is the question this
      // record exists to answer.
      const handedOff = await sendNow(
        {
          dealId: invoice.deal_id,
          purpose: 'invoice_delivery',
          body,
          recipient: phone,
        },
        phone
      )

      if (!handedOff) toast('Could not open WhatsApp', { tone: 'error' })
    } catch {
      toast('Could not send this invoice', { tone: 'error' })
    } finally {
      setSendingWhatsApp(false)
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
                <Text style={[styles.finalValue, { color: c.accentText }]}>{formatINR(netDue)}</Text>
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

          {/* Above Share, because it is the step that now comes first: open
              the chat with the invoice's details, then send the PDF into it. */}
          <TouchableOpacity
            style={[styles.whatsappButton, { borderColor: c.borderStrong }]}
            onPress={handleSendOnWhatsApp}
            disabled={sendingWhatsApp}
            activeOpacity={0.8}
          >
            {sendingWhatsApp ? (
              <ActivityIndicator color={c.textPrimary} />
            ) : (
              <Text style={[styles.shareButtonText, { color: c.textPrimary }]}>
                Send on WhatsApp
              </Text>
            )}
          </TouchableOpacity>

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
    gap: Spacing.xxs,
  },
  paymentDetailsTitle: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.xxs,
  },
  shareButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  // Outlined rather than filled: two solid buttons stacked would compete, and
  // sending the PDF is still the action that finishes the job.
  whatsappButton: {
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  shareButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
