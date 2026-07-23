import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { showAlert } from '@/lib/alert'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getDeal } from '@/lib/deals'
import { createInvoice } from '@/lib/invoices'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'

export default function NewInvoiceScreen() {
  const { dealId } = useLocalSearchParams<{ dealId: string }>()
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [brandName, setBrandName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [gstApplicable, setGstApplicable] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [tdsDeducted, setTdsDeducted] = useState(false)
  const [tdsAmount, setTdsAmount] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!dealId) return
    let active = true
    getDeal(dealId)
      .then((deal) => {
        if (!active) return
        setBrandName(deal.brand?.name ?? '')
        setContactPerson(deal.brand?.contact_person ?? '')
        setContactEmail(deal.brand?.contact_email ?? '')
        setDescription(deal.deliverable_description)
        setAmount(String(deal.rate))
        setDueDate(deal.payment?.due_date ?? '')
      })
      .catch(() => showAlert('Error', 'Could not load this deal.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [dealId])

  const inputStyle = [
    styles.input,
    { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface },
  ]

  async function handleSave() {
    if (!dealId) return
    if (!brandName.trim() || !description.trim()) {
      showAlert('Missing details', 'Brand name and description are required.')
      return
    }
    const amountNum = parseInt(amount, 10)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      showAlert('Invalid amount', 'Enter a valid invoice amount.')
      return
    }

    setSaving(true)
    try {
      const invoice = await createInvoice({
        deal_id: dealId,
        brand_name: brandName.trim(),
        brand_contact_person: contactPerson.trim() || null,
        brand_contact_email: contactEmail.trim() || null,
        description: description.trim(),
        amount: amountNum,
        gst_applicable: gstApplicable,
        payment_due_date: dueDate.trim() || null,
        tds_deducted: tdsDeducted,
        tds_amount: tdsDeducted && tdsAmount.trim() ? parseInt(tdsAmount, 10) : null,
        notes: notes.trim() || null,
      })
      router.replace(`/(app)/invoice/${invoice.id}` as never)
    } catch {
      showAlert('Error', 'Could not create invoice. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Create invoice">
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <ActivityIndicator color={c.textMuted} />
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="Create invoice">
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.content, isWide && styles.contentWide]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Brand / client name</Text>
            <TextInput style={inputStyle} value={brandName} onChangeText={setBrandName} />

            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact person</Text>
            <TextInput style={inputStyle} value={contactPerson} onChangeText={setContactPerson} />

            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Contact email</Text>
            <TextInput style={inputStyle} value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Description</Text>
            <TextInput
              style={[inputStyle, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Amount</Text>
            <View style={styles.rateRow}>
              <View style={[styles.ratePrefix, { borderColor: c.borderStrong, backgroundColor: c.bgSurface }]}>
                <Text style={[styles.ratePrefixText, { color: c.textMuted }]}>₹</Text>
              </View>
              <TextInput
                style={[styles.rateInput, { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface }]}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: c.textPrimary }]}>GST applicable (18%)</Text>
              <Switch value={gstApplicable} onValueChange={setGstApplicable} trackColor={{ false: c.border, true: c.accentLight }} thumbColor={gstApplicable ? c.accent : undefined} />
            </View>

            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Payment due date (YYYY-MM-DD)</Text>
            <TextInput style={inputStyle} value={dueDate} onChangeText={setDueDate} placeholder="2025-09-15" placeholderTextColor={c.textMuted} keyboardType="numbers-and-punctuation" />

            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: c.textPrimary }]}>TDS deducted by brand</Text>
              <Switch value={tdsDeducted} onValueChange={setTdsDeducted} trackColor={{ false: c.border, true: c.accentLight }} thumbColor={tdsDeducted ? c.accent : undefined} />
            </View>
            {tdsDeducted && (
              <>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>TDS amount</Text>
                <TextInput
                  style={inputStyle}
                  value={tdsAmount}
                  onChangeText={(v) => setTdsAmount(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                />
              </>
            )}

            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Notes (optional)</Text>
            <TextInput style={[inputStyle, styles.multiline]} value={notes} onChangeText={setNotes} multiline textAlignVertical="top" />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: c.fillPrimary }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={c.onFillPrimary} />
              ) : (
                <Text style={[styles.saveButtonText, { color: c.onFillPrimary }]}>Create invoice</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  contentWide: { maxWidth: ContentMaxWidth, width: '100%', alignSelf: 'center' },
  sectionLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  multiline: { height: undefined, minHeight: 72, paddingTop: 11, paddingBottom: 11 },
  rateRow: { flexDirection: 'row' },
  ratePrefix: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRightWidth: 0,
    borderTopLeftRadius: Radius.sm,
    borderBottomLeftRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratePrefixText: { ...Typography.body, fontFamily: FontFamily.regular },
  rateInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderTopRightRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  toggleLabel: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  saveButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  saveButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
