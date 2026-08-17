import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import {
  getDeal,
  getDealsForBrand,
  nextDuePayment,
  type DealWithPaymentSummary,
} from '@/lib/deals'
import { createInvoice, type LineItemInput } from '@/lib/invoices'
import { getProfile } from '@/lib/profile'
import { GST_STATE_OPTIONS, stateCodeFromGstin } from '@/constants/gst'
import { formatCurrency, formatDate } from '@/lib/format'
import { amountInWords } from '@/lib/invoiceHtml'
import { ContentMaxWidth, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  Card,
  Chip,
  DateField,
  PressableScale,
  Skeleton,
  TextField,
  useToast,
} from '@/components/ui'

const GST_RATE = 18

interface DraftLine {
  dealId: string | null
  description: string
  amount: string
}

/**
 * Create invoice.
 *
 * Everything that can be derived is derived: the brand and its POC, the
 * amount, the due date, and whether GST applies (from the creator's GSTIN).
 * The creator confirms rather than types.
 *
 * Other unbilled deals for the same brand are offered for consolidation, since
 * a brand's finance team would rather receive one invoice for three reels than
 * three invoices. And the totals are shown as they will print (including the
 * amount in words), so the document is checked before it exists, not after.
 */
import type { DealStatus } from '@/types'

/** A deal can only be invoiced once the work is out the door. */
const BILLABLE_STATUSES: DealStatus[] = ['live', 'unpaid', 'paid']

export default function NewInvoiceScreen() {
  const toast = useToast()
  const { dealId } = useLocalSearchParams<{ dealId: string }>()
  const router = useRouter()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [brandName, setBrandName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [gstApplicable, setGstApplicable] = useState(false)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [tdsDeducted, setTdsDeducted] = useState(false)
  const [tdsAmount, setTdsAmount] = useState('')
  const [notes, setNotes] = useState('')
  // Rule 46 fields. Prefilled from the brand and the creator's profile so the
  // common case is a confirmation rather than data entry.
  const [brandGstin, setBrandGstin] = useState('')
  const [brandAddress, setBrandAddress] = useState('')
  const [placeOfSupply, setPlaceOfSupply] = useState<string | null>(null)
  const [supplierGstin, setSupplierGstin] = useState<string | null>(null)
  const [supplierAddress, setSupplierAddress] = useState<string | null>(null)

  /** Other deals for the same brand that could join this invoice. */
  const [candidates, setCandidates] = useState<DealWithPaymentSummary[]>([])
  const [included, setIncluded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    // Opened from a header "+" rather than from a deal, so there is nothing to
    // prefill. Clearing the flag matters: returning early while `loading` was
    // still true left the screen on its skeletons forever.
    if (!dealId) {
      setLoading(false)
      return
    }
    try {
      const deal = await getDeal(dealId)
      setBrandName(deal.brand?.name ?? '')
      setContactPerson(deal.brand?.contact_person ?? '')
      setContactEmail(deal.brand?.contact_email ?? '')
      setBrandGstin(deal.brand?.gstin ?? '')
      setBrandAddress(deal.brand?.address ?? '')
      // The place of supply for a creator's services is the recipient's
      // location, which the brand's own GSTIN already encodes.
      setPlaceOfSupply(deal.brand?.state_code ?? stateCodeFromGstin(deal.brand?.gstin))
      setDueDate(nextDuePayment(deal)?.due_date ?? null)
      setLines([
        {
          dealId: deal.id,
          description: deal.deliverable_description,
          amount: String(deal.rate),
        },
      ])
      setIncluded(new Set([deal.id]))

      // Only a GST-registered creator may charge GST, so default the switch
      // from the profile instead of asking a question they can get wrong.
      getProfile()
        .then((profile) => {
          setGstApplicable(Boolean(profile.gstin))
          setSupplierGstin(profile.gstin)
          setSupplierAddress(profile.address)
        })
        .catch(() => {})

      // Deals for the same brand that are delivered but not yet billed.
      if (deal.brand_id) {
        getDealsForBrand(deal.brand_id)
          .then((all) =>
            setCandidates(
              all.filter(
                (other) =>
                  other.id !== deal.id &&
                  // Typed, not a bare string array: an untyped one silently
                  // matched nothing after migration 020 renamed these, with no
                  // compiler error and no runtime error either.
                  BILLABLE_STATUSES.includes(other.status)
              )
            )
          )
          .catch(() => {})
      }
    } catch {
      toast('Could not load this deal', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [dealId, toast])

  useEffect(() => {
    load()
  }, [load])

  function toggleCandidate(deal: DealWithPaymentSummary) {
    setIncluded((current) => {
      const next = new Set(current)
      if (next.has(deal.id)) {
        next.delete(deal.id)
        setLines((rows) => rows.filter((row) => row.dealId !== deal.id))
      } else {
        next.add(deal.id)
        setLines((rows) => [
          ...rows,
          {
            dealId: deal.id,
            description: deal.deliverable_description,
            amount: String(deal.rate),
          },
        ])
      }
      return next
    })
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + (parseInt(line.amount, 10) || 0), 0),
    [lines]
  )
  const gstAmount = gstApplicable ? Math.round((subtotal * GST_RATE) / 100) : 0
  const total = subtotal + gstAmount
  const tds = tdsDeducted ? parseInt(tdsAmount, 10) || 0 : 0
  const netPayable = total - tds

  async function handleSave() {
    // Nothing here is mandatory. A half-filled invoice is still a document the
    // creator wanted, and an app that argues with her before it will write
    // anything down is one she stops reaching for mid-negotiation. Everything
    // stays editable afterwards.
    const items: LineItemInput[] = lines
      .filter((line) => line.description.trim() || (parseInt(line.amount, 10) || 0) > 0)
      .map((line) => ({
        deal_id: line.dealId,
        description: line.description.trim(),
        unit_amount: parseInt(line.amount, 10) || 0,
      }))

    setSaving(true)
    try {
      const invoice = await createInvoice({
        // A consolidated invoice belongs to no single deal; the deals travel
        // on the line items instead.
        deal_id: items.length === 1 ? items[0].deal_id : null,
        brand_name: brandName.trim(),
        brand_contact_person: contactPerson.trim() || null,
        brand_contact_email: contactEmail.trim() || null,
        items,
        gst_applicable: gstApplicable,
        brand_gstin: brandGstin.trim() || null,
        brand_address: brandAddress.trim() || null,
        place_of_supply_code: placeOfSupply,
        supplier_gstin: supplierGstin,
        supplier_address: supplierAddress,
        payment_due_date: dueDate,
        tds_deducted: tdsDeducted,
        tds_amount: tds || null,
        notes: notes.trim() || null,
      })
      toast(`${invoice.invoice_number} created`, { tone: 'success' })
      router.replace(`/(app)/invoice/${invoice.id}` as never)
    } catch {
      toast('Could not create the invoice', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="New invoice">
        <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <View style={[styles.content, isWide && styles.contentWide]}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="New invoice">
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, isWide && styles.contentWide]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextField label="Bill to" value={brandName} onChangeText={setBrandName} />
            <TextField
              label="POC"
              placeholder="Who to address it to"
              value={contactPerson}
              onChangeText={setContactPerson}
            />
            <TextField
              label="Email"
              placeholder="finance@brand.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Lines */}
            <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>What you're billing</Text>
            <Animated.View layout={LinearTransition.duration(200)} style={styles.lines}>
              {lines.map((line, index) => (
                <Animated.View key={`${line.dealId ?? 'adhoc'}-${index}`} entering={FadeIn.duration(160)}>
                  <Card variant="outlined" style={styles.lineCard}>
                    <TextField
                      label={`Line ${index + 1}`}
                      value={line.description}
                      onChangeText={(value) => updateLine(index, { description: value })}
                      multiline
                    />
                    <TextField
                      label="Amount"
                      prefix="₹"
                      keyboardType="number-pad"
                      value={line.amount}
                      onChangeText={(value) =>
                        updateLine(index, { amount: value.replace(/[^0-9]/g, '') })
                      }
                    />
                  </Card>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Consolidation */}
            {candidates.length > 0 ? (
              <Card>
                <Text style={[styles.cardTitle, { color: c.textPrimary }]}>
                  Also bill these?
                </Text>
                <Text style={[styles.cardHint, { color: c.textSecondary }]}>
                  Other delivered work for {brandName}. One invoice beats three.
                </Text>
                <View style={styles.candidates}>
                  {candidates.map((deal) => {
                    const on = included.has(deal.id)
                    return (
                      <PressableScale
                        key={deal.id}
                        onPress={() => toggleCandidate(deal)}
                        haptic="selection"
                        style={[
                          styles.candidate,
                          { backgroundColor: on ? c.accentLight : c.bgPage },
                        ]}
                      >
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={19}
                          color={on ? c.accent : c.textMuted}
                        />
                        <View style={styles.candidateText}>
                          <Text
                            style={[styles.candidateTitle, { color: c.textPrimary }]}
                            numberOfLines={1}
                          >
                            {deal.deliverable_description}
                          </Text>
                          <Text style={[styles.candidateMeta, { color: c.textMuted }]}>
                            {deal.publish_date ? formatDate(deal.publish_date) : 'Not published'}
                          </Text>
                        </View>
                        <Text style={[styles.candidateAmount, { color: c.textPrimary }]}>
                          {formatCurrency(deal.rate)}
                        </Text>
                      </PressableScale>
                    )
                  })}
                </View>
              </Card>
            ) : null}

            {/* Tax */}
            <Card>
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Charge GST</Text>
                  <Text style={[styles.cardHint, { color: c.textSecondary }]}>
                    18%, added on top. Only if you're GST registered.
                  </Text>
                </View>
                <Switch
                  value={gstApplicable}
                  onValueChange={setGstApplicable}
                  trackColor={{ false: c.border, true: c.accentLight }}
                  thumbColor={gstApplicable ? c.accent : undefined}
                />
              </View>

              {/*
                Only asked for once GST is actually being charged, because
                these fields exist to satisfy Rule 46 rather than to describe
                the work. The state is what decides IGST against CGST+SGST, so
                the invoice cannot be issued without it.
              */}
              {gstApplicable ? (
                <View style={styles.taxFields}>
                  <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                    Their GSTIN
                  </Text>
                  <TextField
                    placeholder="27AABCU9603R1ZM"
                    value={brandGstin}
                    onChangeText={(next) => {
                      setBrandGstin(next)
                      // The first two characters are the State code, so a
                      // pasted GSTIN answers the place-of-supply question too.
                      const derived = stateCodeFromGstin(next)
                      if (derived) setPlaceOfSupply(derived)
                    }}
                    autoCapitalize="characters"
                  />

                  <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                    Their billing address
                  </Text>
                  <TextField
                    placeholder="Street, city, PIN"
                    value={brandAddress}
                    onChangeText={setBrandAddress}
                    multiline
                  />

                  <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                    Place of supply
                  </Text>
                  <Text style={[styles.cardHint, { color: c.textSecondary }]}>
                    Where the brand is registered. Same state as you means CGST and
                    SGST; a different state means IGST.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stateScroll}
                  >
                    {GST_STATE_OPTIONS.map((option) => (
                      <Chip
                        key={option.code}
                        label={option.name}
                        selected={placeOfSupply === option.code}
                        onPress={() => setPlaceOfSupply(option.code)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={[styles.switchRow, styles.switchRowSpaced]}>
                <View style={styles.switchText}>
                  <Text style={[styles.cardTitle, { color: c.textPrimary }]}>TDS withheld</Text>
                  <Text style={[styles.cardHint, { color: c.textSecondary }]}>
                    Brands usually deduct 10%. You claim it back against Form 26AS.
                  </Text>
                </View>
                <Switch
                  value={tdsDeducted}
                  onValueChange={(next) => {
                    setTdsDeducted(next)
                    // Pre-fill the usual 10% under section 194J rather than
                    // making her reach for a calculator.
                    if (next && !tdsAmount) setTdsAmount(String(Math.round(subtotal * 0.1)))
                  }}
                  trackColor={{ false: c.border, true: c.accentLight }}
                  thumbColor={tdsDeducted ? c.accent : undefined}
                />
              </View>

              {tdsDeducted ? (
                <View style={styles.tdsField}>
                  <TextField
                    label="TDS amount"
                    prefix="₹"
                    keyboardType="number-pad"
                    value={tdsAmount}
                    onChangeText={(value) => setTdsAmount(value.replace(/[^0-9]/g, ''))}
                  />
                </View>
              ) : null}
            </Card>

            <DateField label="Payment due" value={dueDate} onChange={setDueDate} />

            <TextField
              label="Notes"
              placeholder="PO number, or anything their finance team needs"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {/* Preview: exactly the figures that will print. */}
            <Card style={[styles.preview, { backgroundColor: c.bgSurfaceRaised }]}>
              <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Preview</Text>

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: c.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.totalValue, { color: c.textSecondary }]}>
                  {formatCurrency(subtotal)}
                </Text>
              </View>

              {gstApplicable ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: c.textSecondary }]}>
                    GST @ {GST_RATE}%
                  </Text>
                  <Text style={[styles.totalValue, { color: c.textSecondary }]}>
                    {formatCurrency(gstAmount)}
                  </Text>
                </View>
              ) : null}

              {tds > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: c.danger }]}>Less TDS</Text>
                  <Text style={[styles.totalValue, { color: c.danger }]}>
                    − {formatCurrency(tds)}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.totalRow, styles.netRow, { borderTopColor: c.border }]}>
                <Text style={[styles.netLabel, { color: c.textPrimary }]}>Net payable</Text>
                <Text style={[styles.netValue, { color: c.textPrimary }]}>
                  {formatCurrency(netPayable)}
                </Text>
              </View>

              <Text style={[styles.words, { color: c.textMuted }]}>
                {amountInWords(netPayable)}
              </Text>
            </Card>

            <Button
              label={lines.length > 1 ? `Create invoice · ${lines.length} lines` : 'Create invoice'}
              onPress={handleSave}
              loading={saving}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  contentWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    marginTop: Spacing.sm,
  },
  lines: { gap: Spacing.sm },
  lineCard: { gap: Spacing.sm },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  cardHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xxs,
    lineHeight: 18,
  },
  candidates: { gap: Spacing.sm, marginTop: Spacing.md },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
  },
  candidateText: { flex: 1, gap: 1 },
  candidateTitle: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  candidateMeta: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  candidateAmount: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.display,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  switchRowSpaced: { marginTop: Spacing.lg },
  taxFields: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.sm,
  },
  stateScroll: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
  },
  switchText: { flex: 1 },
  tdsField: { marginTop: Spacing.md },
  preview: { gap: Spacing.xxs },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  totalValue: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  netRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  netLabel: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  netValue: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  words: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xs,
    fontStyle: 'normal',
  },
  submit: { marginTop: Spacing.sm },
})
