import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  Platform,
  Linking,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  getDeal,
  updateDeal,
  updatePaymentRecord,
  advanceDealStatus,
  getNextStatus,
  respondToReminder,
  syncPaymentStatus,
  markPaymentReminderSent,
  type DealWithPayments,
} from '@/lib/deals'
import { updateBrand } from '@/lib/brands'
import type { ReminderResponse } from '@/lib/reminders'
import { buildPaymentReminderMessage, buildWhatsAppLink } from '@/lib/whatsapp'
import { getPaymentAlertTone } from '@/lib/paymentReminders'
import { PLATFORMS, STATUS_LABELS, REMINDER_STAGE_LABELS } from '@/constants/labels'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'
import { BrandAvatar } from '@/components/BrandAvatar'
import { StatusPill } from '@/components/StatusPill'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import type { Platform as PlatformType, PaymentStatus } from '@/types'

function parseDate(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [year, month, day] = trimmed.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  if (isNaN(d.getTime()) || d.getMonth() !== month - 1) return null
  return trimmed
}

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light

  const [deal, setDeal] = useState<DealWithPayments | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  // Editable form state — populated from deal once loaded.
  const [platform, setPlatform] = useState<PlatformType>('instagram_reel')
  const [deliverable, setDeliverable] = useState('')
  const [rate, setRate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [scriptDue, setScriptDue] = useState('')
  const [shootDate, setShootDate] = useState('')
  const [editDone, setEditDone] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [liveLink, setLiveLink] = useState('')
  const [notes, setNotes] = useState('')

  // Workflow reminder card (PRODUCT.md 2.3).
  const [respondingReminder, setRespondingReminder] = useState(false)

  // Payment card (PRODUCT.md 2.4).
  const [sendingReminder, setSendingReminder] = useState(false)
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true

    async function load() {
      try {
        const data = await getDeal(id)
        if (!active) return

        // Lazily enforce pending/reminder_sent → overdue before rendering —
        // there's no reliable background execution to do this the moment
        // the due date actually passes (lib/paymentReminders.ts).
        if (data.payment) {
          const syncedStatus = await syncPaymentStatus(data.id, data.payment)
          if (syncedStatus !== data.payment.status) {
            data.payment = { ...data.payment, status: syncedStatus }
          }
        }
        if (!active) return

        setDeal(data)

        // Populate form fields from loaded data.
        setPlatform(data.platform)
        setDeliverable(data.deliverable_description)
        setRate(data.rate.toString())
        setScriptDue(data.script_due_date ?? '')
        setShootDate(data.shoot_date ?? '')
        setEditDone(data.edit_done_date ?? '')
        setPublishDate(data.publish_date ?? '')
        setLiveLink(data.live_link ?? '')
        setNotes(data.notes ?? '')
        setPaymentTerms(data.payment?.payment_terms ?? '')
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [id])

  const handleSave = useCallback(async () => {
    if (!deal || !deal.payment) return

    const rateNum = parseInt(rate, 10)
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      Alert.alert('Invalid rate', 'Enter a valid rate in INR.')
      return
    }

    const datesToValidate = [
      { label: 'Script due date', value: scriptDue },
      { label: 'Shoot date', value: shootDate },
      { label: 'Edit done date', value: editDone },
      { label: 'Publish date', value: publishDate },
    ]
    for (const { label, value } of datesToValidate) {
      if (value.trim() && parseDate(value) === null) {
        Alert.alert('Invalid date', `${label} must be YYYY-MM-DD (e.g. 2025-09-15).`)
        return
      }
    }

    setSaving(true)
    try {
      const parsedPublish = parseDate(publishDate)

      await updateDeal(deal.id, {
        platform,
        deliverable_description: deliverable.trim(),
        rate: rateNum,
        script_due_date: parseDate(scriptDue),
        shoot_date: parseDate(shootDate),
        edit_done_date: parseDate(editDone),
        publish_date: parsedPublish,
        live_link: liveLink.trim() || null,
        notes: notes.trim() || null,
      })

      await updatePaymentRecord(deal, deal.payment, {
        amount: rateNum,
        paymentTerms: paymentTerms.trim() || null,
        publishDate: parsedPublish,
      })

      router.back()
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [
    deal,
    platform,
    deliverable,
    rate,
    paymentTerms,
    scriptDue,
    shootDate,
    editDone,
    publishDate,
    liveLink,
    notes,
  ])

  async function handleAdvanceStatus() {
    if (!deal || advancing) return
    const next = getNextStatus(deal.status)
    if (!next) return

    setAdvancing(true)
    try {
      await advanceDealStatus(deal)
      // Update local state immediately — dashboard refreshes via useFocusEffect when
      // the user navigates back, so no extra work is needed there.
      setDeal((prev) => {
        if (!prev) return prev
        if (next !== 'paid') return { ...prev, status: next }
        // advanceDealStatus also closes out the payment and cancels any
        // still-scheduled reminders when it reaches 'paid'.
        return {
          ...prev,
          status: next,
          reminder_stage: null,
          reminder_fire_at: null,
          reminder_notification_id: null,
          reminder_completed_through: null,
          payment: prev.payment
            ? {
                ...prev.payment,
                status: 'paid',
                paid_date: new Date().toISOString().split('T')[0],
                due_soon_notification_id: null,
                due_today_notification_id: null,
              }
            : null,
        }
      })
    } catch {
      Alert.alert('Error', 'Could not advance status.')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleReminderResponse(response: ReminderResponse) {
    if (!deal || !deal.reminder_stage || respondingReminder) return

    setRespondingReminder(true)
    try {
      const fields = await respondToReminder(deal, response)
      setDeal((prev) => (prev ? { ...prev, ...fields } : prev))
    } catch {
      Alert.alert('Error', 'Could not update reminder. Please try again.')
    } finally {
      setRespondingReminder(false)
    }
  }

  async function handleSendPaymentReminder() {
    if (!deal || sendingReminder) return
    const payment = deal.payment
    const brand = deal.brand
    if (!payment || !brand) return

    const tone = getPaymentAlertTone(payment)
    if (!tone) return

    if (!brand.contact_phone) {
      setAddingPhone(true)
      return
    }

    const link = buildWhatsAppLink(
      brand.contact_phone,
      buildPaymentReminderMessage({
        brandName: brand.name,
        contactPerson: brand.contact_person,
        deliverable: deal.deliverable_description,
        amount: payment.amount,
        dueDate: payment.due_date!,
        tone,
      })
    )
    if (!link) {
      Alert.alert('Invalid phone number', "This brand's phone number couldn't be used to open WhatsApp.")
      return
    }

    setSendingReminder(true)
    try {
      await Linking.openURL(link)
      const newStatus = await markPaymentReminderSent(deal.id, payment.status)
      setDeal((prev) => (prev ? { ...prev, payment: { ...payment, status: newStatus } } : prev))
    } catch {
      Alert.alert('Could not open WhatsApp', 'Please try again.')
    } finally {
      setSendingReminder(false)
    }
  }

  async function handleSavePhone() {
    if (!deal?.brand || savingPhone) return
    const trimmed = phoneInput.trim()
    if (!trimmed) return

    setSavingPhone(true)
    try {
      const updatedBrand = await updateBrand(deal.brand.id, { contact_phone: trimmed })
      setDeal((prev) => (prev ? { ...prev, brand: updatedBrand } : prev))
      setAddingPhone(false)
      setPhoneInput('')
    } catch {
      Alert.alert('Error', 'Could not save phone number. Please try again.')
    } finally {
      setSavingPhone(false)
    }
  }

  // Parses YYYY-MM-DD or an ISO timestamp as a local date/time for display.
  function formatReminderTime(iso: string): string {
    const date = new Date(iso)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  function formatDueDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
  }

  const brandName = deal?.brand?.name ?? ''
  const nextStatus = deal ? getNextStatus(deal.status) : null

  const inputStyle = [
    styles.input,
    {
      borderColor: c.borderStrong,
      color: c.textPrimary,
      backgroundColor: c.bgSurface,
    },
  ]

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Deal' }} />
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <ActivityIndicator color={c.textMuted} />
        </SafeAreaView>
      </>
    )
  }

  if (loadError || !deal) {
    return (
      <>
        <Stack.Screen options={{ title: 'Deal' }} />
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <Text style={[styles.errorText, { color: c.textSecondary }]}>
            Could not load deal.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBack}>
            <Text style={[styles.errorBackText, { color: c.textPrimary }]}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    )
  }

  // ── Main screen ────────────────────────────────────────────────────────────

  return (
    <>
      {/*
        Stack.Screen placed inside the component so headerRight closes over
        handleSave and saving — React re-renders keep the closure current.
      */}
      <Stack.Screen
        options={{
          title: brandName || 'Deal',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={styles.headerSaveButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 0 }}
            >
              <Text
                style={[
                  styles.headerSaveText,
                  { color: saving ? c.textMuted : c.textPrimary },
                ]}
              >
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => Keyboard.dismiss()}>

              {/* ── Status ──────────────────────────────────────────── */}
              <View style={[styles.statusCard, { backgroundColor: c.bgSurface }]}>
                <View style={styles.statusRow}>
                  <StatusPill status={deal.status} />
                  {nextStatus ? (
                    <TouchableOpacity
                      style={[styles.advanceButton, { borderColor: c.borderStrong }]}
                      onPress={handleAdvanceStatus}
                      disabled={advancing}
                      activeOpacity={0.8}
                    >
                      {advancing ? (
                        <ActivityIndicator
                          size="small"
                          color={c.textPrimary}
                          style={styles.advanceSpinner}
                        />
                      ) : (
                        <Text style={[styles.advanceButtonText, { color: c.textPrimary }]}>
                          → {STATUS_LABELS[nextStatus]}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.completedNote, { color: c.textMuted }]}>
                      Deal complete
                    </Text>
                  )}
                </View>
              </View>

              {/* ── Workflow reminder ────────────────────────────── */}
              {/*
                Notifications never carry action buttons — tapping one just
                deep-links here (app/_layout.tsx), where these three
                responses live (PRODUCT.md 2.3). "Done" is the only filled
                pill anywhere on this screen; the other two stay outline so
                DESIGN.md's one-filled-button rule holds even though the
                payment card below can show its own (outline) send button
                at the same time.
              */}
              {deal.reminder_stage ? (
                <View style={[styles.reminderCard, { backgroundColor: c.bgSurface }]}>
                  <Text style={[styles.reminderTitle, { color: c.textPrimary }]}>
                    {REMINDER_STAGE_LABELS[deal.reminder_stage]}
                  </Text>
                  {deal.reminder_fire_at ? (
                    <Text style={[styles.reminderSubtitle, { color: c.textSecondary }]}>
                      {formatReminderTime(deal.reminder_fire_at)}
                    </Text>
                  ) : null}
                  <View style={styles.reminderActions}>
                    <TouchableOpacity
                      style={[styles.reminderDoneButton, { backgroundColor: c.fillPrimary }]}
                      onPress={() => handleReminderResponse('done')}
                      disabled={respondingReminder}
                      activeOpacity={0.8}
                    >
                      {respondingReminder ? (
                        <ActivityIndicator size="small" color={c.onFillPrimary} />
                      ) : (
                        <Text style={[styles.reminderDoneText, { color: c.onFillPrimary }]}>Done</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleReminderResponse('remind_12h')}
                      disabled={respondingReminder}
                      style={styles.reminderSnoozeButton}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.reminderSnoozeText, { color: c.textSecondary }]}>
                        +12 hours
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleReminderResponse('remind_tomorrow')}
                      disabled={respondingReminder}
                      style={styles.reminderSnoozeButton}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.reminderSnoozeText, { color: c.textSecondary }]}>
                        Tomorrow
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* ── Brand (non-editable) ─────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Brand</Text>
              <View style={[styles.brandDisplay, { backgroundColor: c.bgSurface }]}>
                <BrandAvatar name={brandName} size={32} />
                <Text style={[styles.brandDisplayName, { color: c.textPrimary }]}>
                  {brandName}
                </Text>
              </View>

              {/* ── Platform ─────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Platform</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.platformScroll}
              >
                {PLATFORMS.map((p) => {
                  const selected = platform === p.key
                  return (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => setPlatform(p.key)}
                      style={[
                        styles.platformPill,
                        selected
                          ? { backgroundColor: c.fillPrimary }
                          : { borderWidth: 1, borderColor: c.borderStrong },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.platformPillText,
                          { color: selected ? c.onFillPrimary : c.textSecondary },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* ── Deliverable ──────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Deliverable</Text>
              <TextInput
                style={[inputStyle, styles.multiline]}
                value={deliverable}
                onChangeText={setDeliverable}
                multiline
                textAlignVertical="top"
                placeholder="What you're creating"
                placeholderTextColor={c.textMuted}
              />

              {/* ── Rate ─────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Rate</Text>
              <View style={styles.rateRow}>
                <View
                  style={[
                    styles.ratePrefix,
                    { borderColor: c.borderStrong, backgroundColor: c.bgSurface },
                  ]}
                >
                  <Text style={[styles.ratePrefixText, { color: c.textMuted }]}>₹</Text>
                </View>
                <TextInput
                  style={[
                    styles.rateInput,
                    { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurface },
                  ]}
                  value={rate}
                  onChangeText={(v) => setRate(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                />
              </View>

              {/* ── Payment terms ────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Payment terms</Text>
              <TextInput
                style={inputStyle}
                value={paymentTerms}
                onChangeText={setPaymentTerms}
                placeholder='e.g. "45 days from publish"'
                placeholderTextColor={c.textMuted}
              />

              {/* ── Payment ──────────────────────────────────────── */}
              {(() => {
                const payment = deal.payment
                if (!payment) return null
                const tone = getPaymentAlertTone(payment)
                const missingPhone = !deal.brand?.contact_phone

                return (
                  <View style={[styles.paymentCard, { backgroundColor: c.bgSurface }]}>
                    <View style={styles.paymentHeaderRow}>
                      <PaymentStatusBadge status={payment.status} />
                      {payment.due_date ? (
                        <Text style={[styles.paymentDueDate, { color: c.textSecondary }]}>
                          Due {formatDueDate(payment.due_date)}
                        </Text>
                      ) : null}
                    </View>

                    {tone ? (
                      addingPhone ? (
                        <View style={styles.phoneAddRow}>
                          <TextInput
                            style={[inputStyle, styles.phoneInput]}
                            value={phoneInput}
                            onChangeText={setPhoneInput}
                            placeholder="Brand phone number"
                            placeholderTextColor={c.textMuted}
                            keyboardType="phone-pad"
                            autoFocus
                          />
                          <TouchableOpacity
                            style={[styles.phoneSaveButton, { borderColor: c.borderStrong }]}
                            onPress={handleSavePhone}
                            disabled={savingPhone || !phoneInput.trim()}
                            activeOpacity={0.8}
                          >
                            {savingPhone ? (
                              <ActivityIndicator size="small" color={c.textPrimary} />
                            ) : (
                              <Text style={[styles.phoneSaveButtonText, { color: c.textPrimary }]}>
                                Save
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.paymentSendButton, { borderColor: c.borderStrong }]}
                            onPress={handleSendPaymentReminder}
                            disabled={sendingReminder}
                            activeOpacity={0.8}
                          >
                            {sendingReminder ? (
                              <ActivityIndicator size="small" color={c.textPrimary} />
                            ) : (
                              <Text style={[styles.paymentSendButtonText, { color: c.textPrimary }]}>
                                {missingPhone ? 'Add phone number to send' : 'Send WhatsApp reminder'}
                              </Text>
                            )}
                          </TouchableOpacity>
                          {missingPhone ? (
                            <Text style={[styles.paymentCaption, { color: c.textMuted }]}>
                              This brand has no phone number on file yet.
                            </Text>
                          ) : null}
                        </>
                      )
                    ) : null}
                  </View>
                )
              })()}

              {/* ── Timeline ─────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
                Timeline (YYYY-MM-DD)
              </Text>
              <View style={styles.dateGrid}>
                <View style={styles.dateCell}>
                  <Text style={[styles.dateLabel, { color: c.textMuted }]}>Script due</Text>
                  <TextInput
                    style={inputStyle}
                    value={scriptDue}
                    onChangeText={setScriptDue}
                    placeholder="2025-09-01"
                    placeholderTextColor={c.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.dateCell}>
                  <Text style={[styles.dateLabel, { color: c.textMuted }]}>Shoot day</Text>
                  <TextInput
                    style={inputStyle}
                    value={shootDate}
                    onChangeText={setShootDate}
                    placeholder="2025-09-05"
                    placeholderTextColor={c.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.dateCell}>
                  <Text style={[styles.dateLabel, { color: c.textMuted }]}>Edit done</Text>
                  <TextInput
                    style={inputStyle}
                    value={editDone}
                    onChangeText={setEditDone}
                    placeholder="2025-09-10"
                    placeholderTextColor={c.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.dateCell}>
                  <Text style={[styles.dateLabel, { color: c.textMuted }]}>Publish date</Text>
                  <TextInput
                    style={inputStyle}
                    value={publishDate}
                    onChangeText={setPublishDate}
                    placeholder="2025-09-15"
                    placeholderTextColor={c.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              {/* ── Live link ────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Live link</Text>
              <TextInput
                style={inputStyle}
                value={liveLink}
                onChangeText={setLiveLink}
                placeholder="Link to the published post"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              {/* ── Notes ────────────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Notes</Text>
              <TextInput
                style={[inputStyle, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                placeholder="Any additional context"
                placeholderTextColor={c.textMuted}
              />

            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  errorBack: {},
  errorBackText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  // Header save button
  headerSaveButton: {
    marginRight: Spacing.md,
  },
  headerSaveText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  // Scroll content
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  // Status card
  statusCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  advanceButton: {
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceButtonText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  advanceSpinner: {
    width: 60,
  },
  completedNote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  // Brand display (non-editable)
  brandDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  brandDisplayName: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  // Platform pills
  platformScroll: {
    gap: Spacing.sm,
    paddingBottom: 2,
  },
  platformPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  platformPillText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  // Text inputs
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  multiline: {
    height: undefined,
    minHeight: 88,
    paddingTop: 11,
    paddingBottom: 11,
  },
  // Rate row
  rateRow: {
    flexDirection: 'row',
  },
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
  ratePrefixText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
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
  // Timeline grid
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dateCell: {
    width: '48%',
    gap: Spacing.xs,
  },
  dateLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  // Reminder card
  reminderCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  reminderTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  reminderSubtitle: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  reminderDoneButton: {
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderDoneText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  reminderSnoozeButton: {},
  reminderSnoozeText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  // Payment card
  paymentCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentDueDate: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  paymentSendButton: {
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSendButtonText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  paymentCaption: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  phoneAddRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  phoneInput: {
    flex: 1,
  },
  phoneSaveButton: {
    height: 44,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSaveButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
