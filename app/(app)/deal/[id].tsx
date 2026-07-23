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
  Switch,
} from 'react-native'
import { showAlert } from '@/lib/alert'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import {
  getDeal,
  updateDeal,
  updatePaymentRecord,
  updateAdRights,
  updatePerformance,
  advanceDealStatus,
  getNextStatus,
  respondToReminder,
  syncPaymentStatus,
  markPaymentReminderSent,
  type DealWithPayments,
} from '@/lib/deals'
import { updateBrand } from '@/lib/brands'
import type { ReminderResponse } from '@/lib/reminders'
import { buildPaymentReminderMessage, buildLiveLinkMessage, buildWhatsAppLink } from '@/lib/whatsapp'
import { getPaymentAlertTone } from '@/lib/paymentReminders'
import { calculateAdRightsExpiry, getAdRightsStatus, buildMetaAdLibraryUrl } from '@/lib/adRights'
import { submitRating, getRatingForDeal } from '@/lib/reputation'
import { getInvoiceForDeal } from '@/lib/invoices'
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
  type DealAttachment,
} from '@/lib/attachments'
import { PLATFORMS, STATUS_LABELS, REMINDER_STAGE_LABELS } from '@/constants/labels'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'
import { BrandAvatar } from '@/components/BrandAvatar'
import { StatusPill } from '@/components/StatusPill'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import type { Platform as PlatformType, PaymentStatus, BrandRating, Invoice } from '@/types'

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
  const isWide = useIsWideScreen()

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

  // Ad rights (optional add-on term).
  const [adRightsEnabled, setAdRightsEnabled] = useState(false)
  const [adRightsFee, setAdRightsFee] = useState('')
  const [adRightsDuration, setAdRightsDuration] = useState<number | null>(null)
  const [adRightsStartDate, setAdRightsStartDate] = useState('')

  // Attachments (PRODUCT.md 1 — contracts/briefs, stored in Supabase Storage).
  const [attachments, setAttachments] = useState<DealAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(true)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  // Client reputation score (Phase 2) — post-deal survey, prompted once.
  const [existingRating, setExistingRating] = useState<BrandRating | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [paidOnTime, setPaidOnTime] = useState<boolean | null>(null)
  const [easyToWorkWith, setEasyToWorkWith] = useState<boolean | null>(null)
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null)
  const [revisionRounds, setRevisionRounds] = useState('')
  const [ratingNotes, setRatingNotes] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // Manual content performance entry (Phase 2 — see lib/deals.ts updatePerformance).
  const [perfViews, setPerfViews] = useState('')
  const [perfLikes, setPerfLikes] = useState('')
  const [perfComments, setPerfComments] = useState('')
  const [perfSaves, setPerfSaves] = useState('')
  const [savingPerformance, setSavingPerformance] = useState(false)

  // Tax & invoicing (Phase 3) — at most one invoice per deal, generated
  // from the "Create Invoice" button below.
  const [invoice, setInvoice] = useState<Invoice | null>(null)

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
        setAdRightsEnabled(data.ad_rights_granted)
        setAdRightsFee(data.ad_rights_fee != null ? String(data.ad_rights_fee) : '')
        setAdRightsDuration(data.ad_rights_duration_months)
        setAdRightsStartDate(data.ad_rights_start_date ?? '')
        setPerfViews(data.performance_views != null ? String(data.performance_views) : '')
        setPerfLikes(data.performance_likes != null ? String(data.performance_likes) : '')
        setPerfComments(data.performance_comments != null ? String(data.performance_comments) : '')
        setPerfSaves(data.performance_saves != null ? String(data.performance_saves) : '')

        // Best-effort — reputation/invoice lookups never block the deal from loading.
        getRatingForDeal(data.id)
          .then((r) => active && setExistingRating(r))
          .catch(() => {})
        getInvoiceForDeal(data.id)
          .then((inv) => active && setInvoice(inv))
          .catch(() => {})
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

  const refreshAttachments = useCallback(async () => {
    if (!id) return
    try {
      const data = await listAttachments(id)
      setAttachments(data)
    } catch {
      // Non-fatal: attachments section shows an appropriate empty state.
    } finally {
      setLoadingAttachments(false)
    }
  }, [id])

  useEffect(() => {
    refreshAttachments()
  }, [refreshAttachments])

  async function handleAddAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, base64: false })
    if (result.canceled || !result.assets?.[0] || !id) return

    const asset = result.assets[0]
    setUploadingAttachment(true)
    try {
      await uploadAttachment(id, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType })
      await refreshAttachments()
    } catch {
      showAlert('Could not add attachment', 'Please try again.')
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function handleOpenAttachment(attachment: DealAttachment) {
    try {
      const url = await getAttachmentUrl(attachment.path)
      await Linking.openURL(url)
    } catch {
      showAlert('Could not open file', 'Please try again.')
    }
  }

  function handleDeleteAttachment(attachment: DealAttachment) {
    showAlert('Remove attachment', `Remove "${attachment.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAttachment(attachment.path)
            await refreshAttachments()
          } catch {
            showAlert('Could not remove attachment', 'Please try again.')
          }
        },
      },
    ])
  }

  const handleSave = useCallback(async () => {
    if (!deal || !deal.payment) return

    const rateNum = parseInt(rate, 10)
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      showAlert('Invalid rate', 'Enter a valid rate in INR.')
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
        showAlert('Invalid date', `${label} must be YYYY-MM-DD (e.g. 2025-09-15).`)
        return
      }
    }

    if (adRightsEnabled) {
      const feeNum = parseInt(adRightsFee, 10)
      if (!adRightsFee || isNaN(feeNum) || feeNum <= 0) {
        showAlert('Ad rights fee required', 'Enter the ad rights fee, or turn off ad rights.')
        return
      }
      if (!adRightsDuration) {
        showAlert('Ad rights duration required', 'Select how long the ad rights last.')
        return
      }
      if (!adRightsStartDate.trim() || parseDate(adRightsStartDate) === null) {
        showAlert('Ad rights start date required', 'Enter a valid start date (YYYY-MM-DD).')
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

      await updateAdRights(deal, {
        ad_rights_granted: adRightsEnabled,
        ad_rights_fee: adRightsEnabled ? parseInt(adRightsFee, 10) : null,
        ad_rights_duration_months: adRightsEnabled ? adRightsDuration : null,
        ad_rights_start_date: adRightsEnabled ? parseDate(adRightsStartDate) : null,
      })

      router.back()
    } catch {
      showAlert('Error', 'Could not save changes. Please try again.')
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
    adRightsEnabled,
    adRightsFee,
    adRightsDuration,
    adRightsStartDate,
  ])

  // Moving off 'published' is special-cased (PRODUCT.md 2.5): it requires a
  // live link, saves it, generates the brand-notification wa.me message, and
  // clears the live-link-submission reminder if that's what's outstanding —
  // all in one tap, since entering the link *is* what that reminder was for.
  async function handlePublishedToPaymentAwaited() {
    if (!deal || !deal.brand || advancing) return
    const trimmedLink = liveLink.trim()
    if (!trimmedLink) {
      showAlert('Live link required', 'Enter the live link before marking this as live.')
      return
    }

    setAdvancing(true)
    try {
      await updateDeal(deal.id, { live_link: trimmedLink })
      await advanceDealStatus(deal)

      let reminderFields: Partial<DealWithPayments> = {}
      if (deal.reminder_stage === 'live_link_submission') {
        reminderFields = await respondToReminder(deal, 'done')
      }

      setDeal((prev) =>
        prev
          ? { ...prev, status: 'payment_awaited', live_link: trimmedLink, ...reminderFields }
          : prev
      )

      const message = buildLiveLinkMessage({
        brandName: deal.brand.name,
        contactPerson: deal.brand.contact_person,
        deliverable: deal.deliverable_description,
        liveLink: trimmedLink,
      })
      const link = deal.brand.contact_phone ? buildWhatsAppLink(deal.brand.contact_phone, message) : null
      if (link) {
        await Linking.openURL(link)
      } else {
        showAlert(
          'No phone number on file',
          "This brand has no phone number saved, so the live-link message couldn't be prepared. The deal was still moved to payment awaited."
        )
      }
    } catch {
      showAlert('Error', 'Could not advance status.')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleAdvanceStatus() {
    if (!deal || advancing) return
    const next = getNextStatus(deal.status)
    if (!next) return

    if (deal.status === 'published') {
      await handlePublishedToPaymentAwaited()
      return
    }

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
      showAlert('Error', 'Could not advance status.')
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
      showAlert('Error', 'Could not update reminder. Please try again.')
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
      showAlert('Invalid phone number', "This brand's phone number couldn't be used to open WhatsApp.")
      return
    }

    setSendingReminder(true)
    try {
      await Linking.openURL(link)
      const newStatus = await markPaymentReminderSent(deal.id, payment.status)
      setDeal((prev) => (prev ? { ...prev, payment: { ...payment, status: newStatus } } : prev))
    } catch {
      showAlert('Could not open WhatsApp', 'Please try again.')
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
      showAlert('Error', 'Could not save phone number. Please try again.')
    } finally {
      setSavingPhone(false)
    }
  }

  async function handleSubmitRating() {
    if (!deal?.brand || submittingRating) return
    setSubmittingRating(true)
    try {
      const saved = await submitRating({
        deal_id: deal.id,
        brand_id: deal.brand.id,
        rating: ratingValue,
        paid_on_time: paidOnTime,
        easy_to_work_with: easyToWorkWith,
        revision_rounds: revisionRounds.trim() ? parseInt(revisionRounds, 10) : null,
        would_work_again: wouldWorkAgain,
        notes: ratingNotes.trim() || null,
      })
      setExistingRating(saved)
    } catch {
      showAlert('Error', 'Could not save your rating. Please try again.')
    } finally {
      setSubmittingRating(false)
    }
  }

  async function handleSavePerformance() {
    if (!deal || savingPerformance) return
    setSavingPerformance(true)
    try {
      await updatePerformance(deal.id, {
        performance_views: perfViews.trim() ? parseInt(perfViews, 10) : null,
        performance_likes: perfLikes.trim() ? parseInt(perfLikes, 10) : null,
        performance_comments: perfComments.trim() ? parseInt(perfComments, 10) : null,
        performance_saves: perfSaves.trim() ? parseInt(perfSaves, 10) : null,
      })
      showAlert('Saved', 'Performance numbers updated.')
    } catch {
      showAlert('Error', 'Could not save performance numbers. Please try again.')
    } finally {
      setSavingPerformance(false)
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
  const needsLiveLinkFirst = deal?.status === 'published' && !liveLink.trim()

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
      <ModalSheet title="Deal">
      <>
        <Stack.Screen options={{ title: 'Deal' }} />
        <SafeAreaView style={[styles.centered, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <ActivityIndicator color={c.textMuted} />
        </SafeAreaView>
      </>
      </ModalSheet>
    )
  }

  if (loadError || !deal) {
    return (
      <ModalSheet title="Deal">
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
      </ModalSheet>
    )
  }

  // ── Main screen ────────────────────────────────────────────────────────────

  // Shared between the native Stack header (mobile) and ModalSheet's own
  // header (desktop) — see app/(app)/_layout.tsx for which one is active.
  const saveButton = (
    <TouchableOpacity
      onPress={handleSave}
      disabled={saving}
      style={styles.headerSaveButton}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 0 }}
    >
      <Text style={[styles.headerSaveText, { color: saving ? c.textMuted : c.textPrimary }]}>
        {saving ? 'Saving…' : 'Save'}
      </Text>
    </TouchableOpacity>
  )

  return (
    <ModalSheet title={brandName || 'Deal'} headerRight={saveButton}>
    <>
      {/*
        Stack.Screen placed inside the component so headerRight closes over
        handleSave and saving — React re-renders keep the closure current.
      */}
      <Stack.Screen
        options={{
          title: brandName || 'Deal',
          headerRight: () => saveButton,
        }}
      />

      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[styles.content, isWide && styles.contentWide]}
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
                      style={[
                        styles.advanceButton,
                        { borderColor: c.borderStrong },
                        needsLiveLinkFirst && styles.advanceButtonDisabled,
                      ]}
                      onPress={handleAdvanceStatus}
                      disabled={advancing || needsLiveLinkFirst}
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
                {needsLiveLinkFirst ? (
                  <Text style={[styles.statusCaption, { color: c.textMuted }]}>
                    Add the live link below before marking this as live.
                  </Text>
                ) : null}
              </View>

              {/* ── Client reputation score (Phase 2) ─────────────────── */}
              {deal.status === 'paid' && existingRating ? (
                <View style={[styles.ratingSummaryCard, { backgroundColor: c.accentLight }]}>
                  <Text style={[styles.ratingSummaryText, { color: c.accent }]}>
                    You rated this collaboration {existingRating.rating}/5
                  </Text>
                </View>
              ) : null}

              {deal.status === 'paid' && !existingRating ? (
                <View style={[styles.ratingCard, { backgroundColor: c.bgSurface }]}>
                  <Text style={[styles.ratingTitle, { color: c.textPrimary }]}>
                    Rate this collaboration
                  </Text>
                  <Text style={[styles.ratingSubtitle, { color: c.textSecondary }]}>
                    Helps you decide fast if {brandName} reaches out again.
                  </Text>

                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setRatingValue(n)}
                        style={[
                          styles.ratingStar,
                          {
                            backgroundColor: n <= ratingValue ? c.accent : 'transparent',
                            borderColor: n <= ratingValue ? c.accent : c.borderStrong,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.ratingStarText,
                            { color: n <= ratingValue ? c.onFillPrimary : c.textSecondary },
                          ]}
                        >
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.ratingToggleRow}>
                    <TouchableOpacity
                      onPress={() => setPaidOnTime((v) => (v === true ? null : true))}
                      style={[
                        styles.ratingToggle,
                        paidOnTime === true
                          ? { backgroundColor: c.accent }
                          : { borderWidth: 1, borderColor: c.borderStrong },
                      ]}
                    >
                      <Text style={[styles.ratingToggleText, { color: paidOnTime === true ? c.onFillPrimary : c.textSecondary }]}>
                        Paid on time
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setEasyToWorkWith((v) => (v === true ? null : true))}
                      style={[
                        styles.ratingToggle,
                        easyToWorkWith === true
                          ? { backgroundColor: c.accent }
                          : { borderWidth: 1, borderColor: c.borderStrong },
                      ]}
                    >
                      <Text style={[styles.ratingToggleText, { color: easyToWorkWith === true ? c.onFillPrimary : c.textSecondary }]}>
                        Easy to work with
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setWouldWorkAgain((v) => (v === true ? null : true))}
                      style={[
                        styles.ratingToggle,
                        wouldWorkAgain === true
                          ? { backgroundColor: c.accent }
                          : { borderWidth: 1, borderColor: c.borderStrong },
                      ]}
                    >
                      <Text style={[styles.ratingToggleText, { color: wouldWorkAgain === true ? c.onFillPrimary : c.textSecondary }]}>
                        Would work again
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[
                      styles.input,
                      styles.ratingNotesInput,
                      { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurfaceRaised },
                    ]}
                    placeholder="Anything worth remembering about this brand? (optional)"
                    placeholderTextColor={c.textMuted}
                    value={ratingNotes}
                    onChangeText={setRatingNotes}
                    multiline
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[styles.ratingSubmitButton, { backgroundColor: c.fillPrimary }]}
                    onPress={handleSubmitRating}
                    disabled={submittingRating}
                    activeOpacity={0.8}
                  >
                    {submittingRating ? (
                      <ActivityIndicator color={c.onFillPrimary} />
                    ) : (
                      <Text style={[styles.ratingSubmitText, { color: c.onFillPrimary }]}>Save rating</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

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

              {/* ── Ad rights (optional) ──────────────────────────── */}
              <View style={styles.adRightsHeader}>
                <Text style={[styles.sectionLabel, styles.adRightsLabel, { color: c.accent }]}>
                  Ad rights
                </Text>
                <Switch
                  value={adRightsEnabled}
                  onValueChange={setAdRightsEnabled}
                  trackColor={{ false: c.border, true: c.accentLight }}
                  thumbColor={adRightsEnabled ? c.accent : undefined}
                />
              </View>

              {adRightsEnabled && (
                <View style={[styles.adRightsBox, { backgroundColor: c.accentLight, borderColor: c.accent }]}>
                  <Text style={[styles.dateLabel, { color: c.textSecondary }]}>Ad rights fee</Text>
                  <View style={styles.rateRow}>
                    <View style={[styles.ratePrefix, { borderColor: c.borderStrong, backgroundColor: c.bgSurfaceRaised }]}>
                      <Text style={[styles.ratePrefixText, { color: c.textMuted }]}>₹</Text>
                    </View>
                    <TextInput
                      style={[
                        styles.rateInput,
                        { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurfaceRaised },
                      ]}
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      value={adRightsFee}
                      onChangeText={(v) => setAdRightsFee(v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                    />
                  </View>

                  <Text style={[styles.dateLabel, { color: c.textSecondary, marginTop: Spacing.md }]}>
                    Duration
                  </Text>
                  <View style={styles.platformScroll}>
                    {[1, 2, 3, 6, 9, 12].map((months) => {
                      const selected = adRightsDuration === months
                      return (
                        <TouchableOpacity
                          key={months}
                          onPress={() => setAdRightsDuration(months)}
                          style={[
                            styles.platformPill,
                            selected
                              ? { backgroundColor: c.accent }
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
                            {months} {months === 1 ? 'month' : 'months'}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  <Text style={[styles.dateLabel, { color: c.textSecondary, marginTop: Spacing.md }]}>
                    Start date (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { borderColor: c.borderStrong, color: c.textPrimary, backgroundColor: c.bgSurfaceRaised },
                    ]}
                    placeholder="2025-09-15"
                    placeholderTextColor={c.textMuted}
                    value={adRightsStartDate}
                    onChangeText={setAdRightsStartDate}
                    keyboardType="numbers-and-punctuation"
                  />

                  {adRightsDuration && parseDate(adRightsStartDate) && (
                    <Text style={[styles.adRightsExpiryNote, { color: c.accent }]}>
                      Expires{' '}
                      {calculateAdRightsExpiry(parseDate(adRightsStartDate), adRightsDuration)} — you'll
                      get a reminder 30 days before.
                    </Text>
                  )}

                  {getAdRightsStatus(deal) === 'expired' && (
                    <Text style={[styles.adRightsExpiryNote, { color: c.danger }]}>
                      These ad rights have expired.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.metaAdLibraryButton, { borderColor: c.accent }]}
                    onPress={() => Linking.openURL(buildMetaAdLibraryUrl(brandName))}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="search-outline" size={15} color={c.accent} />
                    <Text style={[styles.metaAdLibraryButtonText, { color: c.accent }]}>
                      Check Meta Ad Library
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Attachments ──────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Attachments</Text>
              <View style={[styles.attachmentsBox, { backgroundColor: c.bgSurface }]}>
                {loadingAttachments ? (
                  <ActivityIndicator color={c.textMuted} style={styles.attachmentsLoading} />
                ) : attachments.length === 0 ? (
                  <Text style={[styles.attachmentsEmpty, { color: c.textMuted }]}>
                    No attachments yet — contracts, briefs, anything worth keeping with this deal.
                  </Text>
                ) : (
                  attachments.map((a, index) => (
                    <View
                      key={a.path}
                      style={[
                        styles.attachmentRow,
                        index < attachments.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: c.border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.attachmentNameButton}
                        onPress={() => handleOpenAttachment(a)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="document-outline" size={18} color={c.textSecondary} />
                        <Text
                          style={[styles.attachmentName, { color: c.textPrimary }]}
                          numberOfLines={1}
                        >
                          {a.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteAttachment(a)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={c.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
              <TouchableOpacity
                style={[styles.addAttachmentButton, { borderColor: c.borderStrong }]}
                onPress={handleAddAttachment}
                disabled={uploadingAttachment}
                activeOpacity={0.8}
              >
                {uploadingAttachment ? (
                  <ActivityIndicator size="small" color={c.textPrimary} />
                ) : (
                  <Text style={[styles.addAttachmentText, { color: c.textPrimary }]}>
                    + Add file
                  </Text>
                )}
              </TouchableOpacity>

              {/* ── Content performance (Phase 2, manual entry) ───────── */}
              {(deal.status === 'published' || deal.status === 'payment_awaited' || deal.status === 'paid') && (
                <>
                  <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
                    Performance
                  </Text>
                  <Text style={[styles.performanceHint, { color: c.textMuted }]}>
                    Entered manually for now — auto-sync from Instagram/YouTube needs those accounts connected, which isn't set up yet.
                  </Text>
                  <View style={styles.performanceGrid}>
                    <View style={styles.dateCell}>
                      <Text style={[styles.dateLabel, { color: c.textMuted }]}>Views</Text>
                      <TextInput
                        style={inputStyle}
                        value={perfViews}
                        onChangeText={(v) => setPerfViews(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={c.textMuted}
                      />
                    </View>
                    <View style={styles.dateCell}>
                      <Text style={[styles.dateLabel, { color: c.textMuted }]}>Likes</Text>
                      <TextInput
                        style={inputStyle}
                        value={perfLikes}
                        onChangeText={(v) => setPerfLikes(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={c.textMuted}
                      />
                    </View>
                    <View style={styles.dateCell}>
                      <Text style={[styles.dateLabel, { color: c.textMuted }]}>Comments</Text>
                      <TextInput
                        style={inputStyle}
                        value={perfComments}
                        onChangeText={(v) => setPerfComments(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={c.textMuted}
                      />
                    </View>
                    <View style={styles.dateCell}>
                      <Text style={[styles.dateLabel, { color: c.textMuted }]}>Saves</Text>
                      <TextInput
                        style={inputStyle}
                        value={perfSaves}
                        onChangeText={(v) => setPerfSaves(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={c.textMuted}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.addAttachmentButton, { borderColor: c.borderStrong }]}
                    onPress={handleSavePerformance}
                    disabled={savingPerformance}
                    activeOpacity={0.8}
                  >
                    {savingPerformance ? (
                      <ActivityIndicator size="small" color={c.textPrimary} />
                    ) : (
                      <Text style={[styles.addAttachmentText, { color: c.textPrimary }]}>
                        Save performance
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* ── Invoice (Phase 3) ──────────────────────────────────── */}
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Invoice</Text>
              <TouchableOpacity
                style={[styles.addAttachmentButton, { borderColor: c.accent }]}
                onPress={() =>
                  invoice
                    ? router.push(`/(app)/invoice/${invoice.id}` as never)
                    : router.push(`/(app)/invoice/new?dealId=${deal.id}` as never)
                }
                activeOpacity={0.8}
              >
                <Text style={[styles.addAttachmentText, { color: c.accent }]}>
                  {invoice ? `View invoice (${invoice.invoice_number})` : 'Create invoice'}
                </Text>
              </TouchableOpacity>

            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
    </ModalSheet>
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
  contentWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
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
  advanceButtonDisabled: {
    opacity: 0.4,
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
  statusCaption: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.sm,
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
  // Ad rights
  adRightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  adRightsLabel: {
    marginTop: 0,
    marginBottom: 0,
    fontFamily: FontFamily.medium,
  },
  adRightsBox: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  adRightsExpiryNote: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.sm,
  },
  metaAdLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.full,
    marginTop: Spacing.md,
  },
  metaAdLibraryButtonText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  // Reputation score
  ratingSummaryCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  ratingSummaryText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  ratingCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  ratingTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  ratingSubtitle: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: -4,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  ratingStar: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStarText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  ratingToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  ratingToggle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  ratingToggleText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  ratingNotesInput: {
    height: undefined,
    minHeight: 60,
    paddingTop: 11,
    paddingBottom: 11,
  },
  ratingSubmitButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSubmitText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  // Performance
  performanceHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  // Attachments
  attachmentsBox: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  attachmentsLoading: {
    paddingVertical: Spacing.md,
  },
  attachmentsEmpty: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    padding: Spacing.md,
    lineHeight: 18,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  attachmentNameButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  attachmentName: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    flex: 1,
  },
  addAttachmentButton: {
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  addAttachmentText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
})
