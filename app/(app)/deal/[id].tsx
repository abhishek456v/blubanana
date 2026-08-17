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
  ActivityIndicator,
  Switch,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { notificationsEnabledAsync } from '@/lib/notifications'
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
import { buildPaymentReminderMessage, buildLiveLinkMessage } from '@/lib/whatsapp'
import { chasedToday, nextEscalationLevel, sendNow } from '@/lib/messaging'
import { getPaymentAlertTone } from '@/lib/paymentReminders'
import { getAdRightsStatus, buildMetaAdLibraryUrl } from '@/lib/adRights'
import { submitRating, getRatingForDeal } from '@/lib/reputation'
import { getInvoiceForDeal } from '@/lib/invoices'
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
  type DealAttachment,
} from '@/lib/attachments'
import {
  adRightsExpiry,
  contentValue,
  getDeliverables,
  replaceDeliverables,
  summarizeDeliverables,
  type DeliverableInput,
} from '@/lib/deliverables'
import { DeliverablesCard } from '@/components/deal/DeliverablesCard'
import { TimelineCard } from '@/components/deal/TimelineCard'
import { MessageHistoryCard } from '@/components/deal/MessageHistoryCard'
import type { DeliverableDraft } from '@/components/deal/DeliverableEditor'
import {
  Chip,
  Figure,
  FigureBlock,
  GradientCard,
  StarRating,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/format'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  REMINDER_STAGE_LABELS,
} from '@/constants/labels'
import {
  ColumnGap,
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { BrandAvatar } from '@/components/BrandAvatar'
import { StatusPill } from '@/components/StatusPill'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import type {
  Platform as PlatformType,
  PaymentStatus,
  BrandRating,
  Deliverable,
  Invoice,
} from '@/types'

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
  const toast = useToast()
  const confirm = useConfirm()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()

  const [deal, setDeal] = useState<DealWithPayments | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  // Editable form state, populated from deal once loaded.
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

  // Ad-rights terms live on the `ad_rights` deliverable now, not in local
  // form state. See handleDeliverablesChange, which mirrors them onto the
  // deal's own ad_rights_* columns for the expiry reminder.

  // Typed line items (migration 007). `deliverable`/`rate` above are still
  // maintained as a rendering of these, for everything that predates them.
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [savingDeliverables, setSavingDeliverables] = useState(false)

  // Attachments (PRODUCT.md 1: contracts/briefs, stored in Supabase Storage).
  const [attachments, setAttachments] = useState<DealAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(true)
  // Distinct from "none uploaded". A storage failure used to render the empty
  // state, so a policy that denied every read for weeks looked exactly like a
  // deal with no files attached.
  const [attachmentsError, setAttachmentsError] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  // Client reputation score (Phase 2): post-deal survey, prompted once.
  const [existingRating, setExistingRating] = useState<BrandRating | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [paidOnTime, setPaidOnTime] = useState<boolean | null>(null)
  const [easyToWorkWith, setEasyToWorkWith] = useState<boolean | null>(null)
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null)
  const [revisionRounds, setRevisionRounds] = useState('')
  const [ratingNotes, setRatingNotes] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // Manual content performance entry (Phase 2; see lib/deals.ts updatePerformance).
  const [perfViews, setPerfViews] = useState('')
  const [perfLikes, setPerfLikes] = useState('')
  const [perfComments, setPerfComments] = useState('')
  const [perfSaves, setPerfSaves] = useState('')
  const [savingPerformance, setSavingPerformance] = useState(false)

  // Tax & invoicing (Phase 3): at most one invoice per deal, generated
  // from the "Create Invoice" button below.
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  // Workflow reminder card (PRODUCT.md 2.3).
  const [respondingReminder, setRespondingReminder] = useState(false)
  // Checked on mount rather than stored: the creator can flip this in iOS
  // Settings at any time, entirely outside the app.
  const [notificationsOff, setNotificationsOff] = useState(false)

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

        // Lazily enforce pending/reminder_sent → overdue before rendering:
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
        setPerfViews(data.performance_views != null ? String(data.performance_views) : '')
        setPerfLikes(data.performance_likes != null ? String(data.performance_likes) : '')
        setPerfComments(data.performance_comments != null ? String(data.performance_comments) : '')
        setPerfSaves(data.performance_saves != null ? String(data.performance_saves) : '')

        // Best-effort: deliverable/reputation/invoice lookups never block the
        // deal from loading.
        getDeliverables(data.id)
          .then((items) => active && setDeliverables(items))
          .catch(() => {})
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
      setAttachmentsError(false)
    } catch {
      // Non-fatal for the rest of the screen, but it must not be silent.
      setAttachments([])
      setAttachmentsError(true)
    } finally {
      setLoadingAttachments(false)
    }
  }, [id])

  useEffect(() => {
    refreshAttachments()
  }, [refreshAttachments])

  useEffect(() => {
    // Web has no notification scheduler at all, so `enabled` is always false
    // there. Showing "turn them on in Settings" on a build that could never
    // deliver one sends the creator hunting for a switch that does not exist.
    if (Platform.OS === 'web') return
    let active = true
    notificationsEnabledAsync().then((enabled) => {
      if (active) setNotificationsOff(!enabled)
    })
    return () => {
      active = false
    }
  }, [])

  /**
   * Saves the line items immediately rather than waiting for the screen's
   * Save button. The editor sheet already has its own explicit Save, so
   * requiring a second one further down the page is the kind of thing that
   * silently loses a creator's edits.
   */
  async function handleDeliverablesChange(drafts: DeliverableDraft[]) {
    if (!deal || savingDeliverables) return
    setSavingDeliverables(true)

    const items: DeliverableInput[] = drafts.map((draft) => {
      const months = Number(draft.duration_months) || null
      return {
        kind: draft.kind,
        platform: draft.platform,
        quantity: draft.quantity,
        description: draft.description.trim() || null,
        rate: Number(draft.rate) || 0,
        due_date: draft.due_date,
        live_link: draft.live_link,
        published_at: draft.published_at,
        duration_months: months,
        starts_on: draft.starts_on,
        expires_on: adRightsExpiry(draft.starts_on, months),
      }
    })

    try {
      const saved = await replaceDeliverables(deal.id, items)
      setDeliverables(saved)

      // Mirror the ad-rights line item onto the deal's own columns. Those are
      // what schedule the 30-day expiry reminder and what getAdRightsStatus
      // reads on the dashboard, so they cannot be left behind. Clearing
      // them when the item is removed is what cancels a stale reminder.
      const adRights = saved.find((item) => item.kind === 'ad_rights')
      const adRightsFields = await updateAdRights(deal, {
        ad_rights_granted: Boolean(adRights),
        ad_rights_fee: adRights?.rate ?? null,
        ad_rights_duration_months: adRights?.duration_months ?? null,
        ad_rights_start_date: adRights?.starts_on ?? null,
      })

      // Mirror the derived figures back into local state so the rest of the
      // screen (rate field, header total) reflects the change without a reload.
      const summary = summarizeDeliverables(items)
      const contentTotal = contentValue(saved)
      setDeliverable(summary)
      setRate(String(contentTotal))
      setDeal({
        ...deal,
        deliverable_description: summary,
        rate: contentTotal,
        ...adRightsFields,
      })
    } catch {
      toast('Could not save the deliverables. Please try again', { tone: 'error' })
    } finally {
      setSavingDeliverables(false)
    }
  }

  async function handleAddAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, base64: false })
    if (result.canceled || !result.assets?.[0] || !id) return

    const asset = result.assets[0]
    setUploadingAttachment(true)
    try {
      await uploadAttachment(id, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType })
      await refreshAttachments()
    } catch {
      toast('Please try again', { tone: 'error' })
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function handleOpenAttachment(attachment: DealAttachment) {
    try {
      const url = await getAttachmentUrl(attachment.path)
      await Linking.openURL(url)
    } catch {
      toast('Please try again', { tone: 'error' })
    }
  }

  async function handleDeleteAttachment(attachment: DealAttachment) {
    const confirmed = await confirm({
      title: 'Remove attachment?',
      message: `"${attachment.name}" will be deleted. A signed contract is worth keeping if this deal is ever disputed.`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!confirmed) return

    try {
      await deleteAttachment(attachment.path)
      await refreshAttachments()
    } catch {
      toast('Could not remove that attachment', { tone: 'error' })
    }
  }

  const handleSave = useCallback(async () => {
    if (!deal || !deal.payment) return

    const rateNum = parseInt(rate, 10)
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      toast('Enter a valid rate in INR', { tone: 'warning' })
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
        // Defensive only: every date on this screen now comes from the
        // calendar picker, so an unparseable one would mean a bug, not typing.
        toast(`${label} isn't a valid date`, { tone: 'warning' })
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

      // Ad rights are not written here. They are saved by the Deliverables
      // card the moment its editor is confirmed, which also syncs the deal's
      // ad_rights_* columns and reschedules the expiry reminder. Writing them
      // again from stale local state would undo that.

      router.back()
    } catch {
      toast('Could not save changes. Please try again', { tone: 'error' })
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

  // Moving off 'published' is special-cased (PRODUCT.md 2.5): it requires a
  // live link, saves it, generates the brand-notification wa.me message, and
  // clears the live-link-submission reminder if that's what's outstanding,
  // all in one tap, since entering the link *is* what that reminder was for.
  async function handlePublishedToPaymentAwaited() {
    if (!deal || !deal.brand || advancing) return
    const trimmedLink = liveLink.trim()
    if (!trimmedLink) {
      toast('Enter the live link before marking this as live', { tone: 'warning' })
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

      // Logged to the outbox like every other brand-facing message. Sending
      // this one through a side door would leave a gap in the very history
      // that makes the payment chasers defensible.
      const handedOff = await sendNow(
        {
          dealId: deal.id,
          purpose: 'delivery_notification',
          body: buildLiveLinkMessage({
            brandName: deal.brand.name,
            contactPerson: deal.brand.contact_person,
            deliverable: deal.deliverable_description,
            liveLink: trimmedLink,
          }),
        },
        deal.brand.contact_phone
      )

      if (!handedOff) {
        toast(
          'Deal moved to payment awaited. Add a phone number for this brand to send the live link.',
          { tone: 'warning' }
        )
      }
    } catch {
      toast('Could not advance status', { tone: 'error' })
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
      // Update local state immediately. Dashboard refreshes via useFocusEffect when
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
      toast('Could not advance status', { tone: 'error' })
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
      toast('Could not update reminder. Please try again', { tone: 'error' })
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

    setSendingReminder(true)
    try {
      // Tone is driven by how many chasers have actually gone out, not by how
      // overdue the payment is. Someone who only started chasing today should
      // not open with the wording of a fourth follow-up.
      const escalationLevel = await nextEscalationLevel(payment.id)

      if (await chasedToday(payment.id)) {
        const again = await confirm({
          title: 'Already chased today',
          message: 'You sent a reminder for this payment earlier today. Send another?',
          confirmLabel: 'Send anyway',
        })
        if (!again) {
          setSendingReminder(false)
          return
        }
      }

      const body = buildPaymentReminderMessage({
        brandName: brand.name,
        contactPerson: brand.contact_person,
        deliverable: deal.deliverable_description,
        amount: payment.amount,
        dueDate: payment.due_date!,
        tone,
        escalationLevel,
        liveLink: deal.live_link,
        invoiceNumber: invoice?.invoice_number ?? null,
      })

      // Logged to the outbox before it leaves, so "I chased them on the 3rd,
      // the 10th and the 24th" is evidence the creator actually holds if this
      // payment is ever disputed.
      const handedOff = await sendNow(
        {
          dealId: deal.id,
          paymentId: payment.id,
          purpose: tone === 'due_soon' ? 'payment_reminder_pre' : 'payment_reminder_overdue',
          body,
          escalationLevel,
        },
        brand.contact_phone
      )

      if (!handedOff) {
        toast("This brand's phone number couldn't be used to open WhatsApp", { tone: 'warning' })
        return
      }

      const newStatus = await markPaymentReminderSent(deal.id, payment.status)
      setDeal((prev) => (prev ? { ...prev, payment: { ...payment, status: newStatus } } : prev))
    } catch {
      toast('Could not open WhatsApp', { tone: 'error' })
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
      toast('Could not save phone number. Please try again', { tone: 'error' })
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
      toast('Could not save your rating. Please try again', { tone: 'error' })
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
      toast('Performance numbers updated', { tone: 'success' })
    } catch {
      toast('Could not save performance numbers. Please try again', { tone: 'error' })
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
  // Ad rights are entered as a line item now. The deal's own ad_rights_*
  // columns are kept in sync from it (see handleDeliverablesChange) because
  // the expiry reminder and the Ad Library check read those, not the item.
  const adRightsItem = deliverables.find((item) => item.kind === 'ad_rights') ?? null
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

  // Shared between the native Stack header and the inline save control
  // header (desktop). See app/(app)/_layout.tsx for which one is active.
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
    <>
      {/*
        Stack.Screen placed inside the component so headerRight closes over
        handleSave and saving; React re-renders keep the closure current.
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
            contentContainerStyle={[styles.content, styles.contentWide]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => Keyboard.dismiss()}>

              {/* Who, how much, and by when — the three things you open a deal
                  to check, on the one surface that carries them all. Below it
                  the screen is a form, and a form is a poor way to answer a
                  question you only wanted to glance at. */}
              <GradientCard
                gradient="blue"
                style={styles.hero}
                action={<StatusPill status={deal.status} onGradient />}
              >
                <View style={styles.heroBrand}>
                  <BrandAvatar name={brandName} size={34} />
                  <Text style={styles.heroBrandName} numberOfLines={1}>
                    {brandName}
                  </Text>
                </View>

                <View style={styles.heroFigures}>
                  <FigureBlock
                    label={summarizeDeliverables(deliverables) || PLATFORM_LABELS[platform]}
                    figure={
                      <Figure
                        value={formatCurrency(parseInt(rate, 10) || 0)}
                        size="hero"
                        color="#FFFFFF"
                        bold
                      />
                    }
                  />
                  {deal.payment?.due_date ? (
                    <FigureBlock
                      align="right"
                      label={deal.payment.status === 'paid' ? 'Paid' : 'Payment due'}
                      figure={
                        <Figure
                          value={formatDate(deal.payment.due_date)}
                          size="lg"
                          color="#FFFFFF"
                        />
                      }
                    />
                  ) : null}
                </View>
              </GradientCard>

              {/* Two columns on desktop, split by subject rather than by
                  importance: the left is the work (what is being made, and
                  when), the right is the money and then the paperwork. The
                  previous cut ran between "the deal" and "things attached to
                  it", which put the rate, the terms and the payment in one
                  column and the invoice for them in the other.

                  Below `desktop` they stack in this order, so the mobile
                  reading order is the same three groups. */}
              <View style={isDesktop ? styles.columns : undefined}>
                <View style={isDesktop ? styles.mainColumn : undefined}>
                  <Text style={[styles.groupHeading, { color: c.textPrimary }]}>The work</Text>
                  {/* ── Status ──────────────────────────────────────────
                      The pill itself is on the hero. What is left here is the
                      thing you can do about it: advance the deal to its next
                      stage. Stating "Live" twice, once above the other, made
                      the card look like it was showing something the hero was
                      not. */}
                  <View style={[styles.statusCard, { backgroundColor: c.bgSurface }]}>
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusStage, { color: c.textSecondary }]}>
                        {STATUS_LABELS[deal.status]}
                      </Text>
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
                      <Text style={[styles.ratingSummaryText, { color: c.accentText }]}>
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

                      {/* Actual stars. This was five numbered square buttons,
                          which read as a form field rather than a judgement,
                          the wrong feel for "would you work with them again?" */}
                      <View style={styles.ratingStars}>
                        <StarRating value={ratingValue} onChange={setRatingValue} size={30} />
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
                    Notifications never carry action buttons; tapping one just
                    deep-links here (app/_layout.tsx), where these three
                    responses live (PRODUCT.md 2.3). "Done" is the only filled
                    pill anywhere on this screen; the other two stay outline so
                    the one-filled-button rule holds even though the
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

                      {/*
                        The product's first promise is that she never misses a
                        deadline, so a reminder the OS will never deliver has
                        to say so here. Permission is only ever requested from
                        inside a save, and iOS refuses to ask twice, so without
                        this line a single dismissed prompt silently disables
                        every nudge in the app for good.
                      */}
                      {notificationsOff ? (
                        <Text style={[styles.reminderWarning, { color: c.warning }]}>
                          Notifications are off, so this will only appear here. Turn them
                          on for CreatorDesk in Settings.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* The brand used to be restated here as a read-only row.
                      It is on the hero above, next to the rate, which is where
                      it was always being read from. */}

                  {/* ── Platform ─────────────────────────────────────── */}
                  <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Platform</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.platformScroll}
                  >
                    {PLATFORMS.map((p) => {
                      return (
                        <Chip
                          key={p.key}
                          label={p.label}
                          selected={platform === p.key}
                          onPress={() => setPlatform(p.key)}
                        />
                      )
                    })}
                  </ScrollView>

                  {/* ── Deliverables ─────────────────────────────────────
                      Replaces the old free-text deliverable field and the single
                      rate input. Both are now derived from the line items, so the
                      rate is the sum of what was actually sold rather than a
                      number typed separately that could disagree with it. */}
                  <View style={styles.deliverablesBlock}>
                    <DeliverablesCard
                      deliverables={deliverables}
                      onChange={handleDeliverablesChange}
                      disabled={savingDeliverables}
                    />
                  </View>

                  {/* ── Ad rights ────────────────────────────────────────
                      The fee, duration and start date are edited as an `ad_rights`
                      line item in the Deliverables card above. This block used to
                      duplicate all three, which meant the same term could be
                      entered twice and disagree with itself. What is left is the
                      part the line item can't express: whether the licence has
                      run out, and the one-tap Ad Library check. */}
                  {adRightsItem ? (
                    <View
                      style={[styles.adRightsBox, { backgroundColor: c.accentLight, borderColor: c.accent }]}
                    >
                      <Text style={[styles.sectionLabel, styles.adRightsLabel, { color: c.accentText }]}>
                        Ad rights
                      </Text>

                      {adRightsItem.expires_on ? (
                        <Text
                          style={[
                            styles.adRightsExpiryNote,
                            {
                              color:
                                getAdRightsStatus(deal) === 'expired' ? c.danger : c.textSecondary,
                            },
                          ]}
                        >
                          {getAdRightsStatus(deal) === 'expired'
                            ? `Expired ${formatDateLong(adRightsItem.expires_on)}. The brand should have stopped running ads.`
                            : `Runs until ${formatDateLong(adRightsItem.expires_on)}. You'll get a reminder 30 days before.`}
                        </Text>
                      ) : (
                        <Text style={[styles.adRightsExpiryNote, { color: c.textSecondary }]}>
                          Add a start date and duration to the ad rights item above to track expiry.
                        </Text>
                      )}

                      <TouchableOpacity
                        style={[styles.metaAdLibraryButton, { borderColor: c.accent }]}
                        onPress={() => Linking.openURL(buildMetaAdLibraryUrl(brandName))}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="search-outline" size={15} color={c.accent} />
                        <Text style={[styles.metaAdLibraryButtonText, { color: c.accentText }]}>
                          Check Meta Ad Library
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}


                  {/* ── Timeline ─────────────────────────────────────────
                      A stage tracker plus real date pickers, replacing the grid
                      of hand-typed YYYY-MM-DD inputs this screen used to carry. */}
                  <View style={styles.deliverablesBlock}>
                    <TimelineCard
                      status={deal.status}
                      scriptDue={scriptDue}
                      shootDate={shootDate}
                      editDone={editDone}
                      publishDate={publishDate}
                      onChange={(field, value) => {
                        if (field === 'script') setScriptDue(value)
                        else if (field === 'shoot') setShootDate(value)
                        else if (field === 'edit') setEditDone(value)
                        else setPublishDate(value)
                      }}
                    />
                  </View>

                </View>

                <View style={isDesktop ? styles.sideColumn : undefined}>
                  <Text style={[styles.groupHeading, { color: c.textPrimary }]}>The money</Text>

                  {/* ── Payment terms ────────────────────────────────── */}
                  <View style={styles.fieldStack}>
                    <TextField
                      label="Payment terms"
                      value={paymentTerms}
                      onChangeText={setPaymentTerms}
                      placeholder="45 days from publish"
                      hint="The payment clock starts from the publish date"
                    />
                  </View>

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
                    <Text style={[styles.addAttachmentText, { color: c.accentText }]}>
                      {invoice ? `View invoice (${invoice.invoice_number})` : 'Create invoice'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.groupHeading, styles.groupHeadingGap, { color: c.textPrimary }]}>
                    The paperwork
                  </Text>

                  {/* ── Live link + notes ────────────────────────────── */}
                  <View style={styles.fieldStack}>
                    <TextField
                      label="Live link"
                      value={liveLink}
                      onChangeText={setLiveLink}
                      placeholder="https://instagram.com/reel/…"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      hint="Goes into the delivery message and starts the payment clock"
                    />

                    <TextField
                      label="Notes"
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      placeholder="Anything worth remembering next time they message"
                    />
                  </View>


                  <View style={styles.deliverablesBlock}>
                    <MessageHistoryCard dealId={deal.id} />
                  </View>

                  {/* ── Attachments ──────────────────────────────────── */}
                  <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Attachments</Text>
                  <View style={[styles.attachmentsBox, { backgroundColor: c.bgSurface }]}>
                    {loadingAttachments ? (
                      <ActivityIndicator color={c.textMuted} style={styles.attachmentsLoading} />
                    ) : attachmentsError ? (
                      <TouchableOpacity onPress={refreshAttachments} activeOpacity={0.8}>
                        <Text style={[styles.attachmentsEmpty, { color: c.danger }]}>
                          Could not load your files. Tap to try again.
                        </Text>
                      </TouchableOpacity>
                    ) : attachments.length === 0 ? (
                      <Text style={[styles.attachmentsEmpty, { color: c.textMuted }]}>
                        No attachments yet. Contracts, briefs, anything worth keeping with this deal.
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
                        Entered manually for now. Auto-sync from Instagram/YouTube needs those accounts connected, which isn't set up yet.
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


                </View>
              </View>
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
  contentWide: {
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'flex-start',
  },
  // The deal itself earns the wider column: it holds the deliverables editor
  // and the timeline, both of which are rows of controls rather than prose.
  hero: {
    marginBottom: Spacing.lg,
  },
  statusStage: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  heroBrandName: {
    flex: 1,
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  heroFigures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  // Names the three groups the screen is cut into. Without them the columns
  // read as one long form and the reader has to infer the grouping from the
  // order, which is exactly what the old layout asked of them.
  groupHeading: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    marginBottom: Spacing.base,
  },
  groupHeadingGap: {
    marginTop: Spacing.xl,
  },
  mainColumn: {
    flex: 1.35,
  },
  sideColumn: {
    flex: 1,
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
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
  },
  brandDisplayName: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  // Platform pills
  platformScroll: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xxs,
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
  // The card brings its own surface and padding, so it sits outside the
  // screen's label/input rhythm rather than inside it.
  // TextField brings its own label and spacing, so grouped fields just need
  // a consistent gap rather than the old label/input margin rhythm.
  fieldStack: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  deliverablesBlock: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  // Rate row
  // Timeline grid
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
  reminderWarning: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: Spacing.base,
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
    paddingVertical: Spacing.base,
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
