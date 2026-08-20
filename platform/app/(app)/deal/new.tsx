import { useState, useCallback, useEffect } from 'react'
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
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio'
import { File } from 'expo-file-system'
import { Ionicons } from '@expo/vector-icons'
import { formatCurrency, formatDate } from '@/lib/format'
import { getBrands } from '@/lib/brands'
import {
  createDeal,
  generateRetainerMonths,
  getDeals,
  repeatCandidates,
  rescheduleWorkflow,
  type RepeatCandidate,
} from '@/lib/deals'
import { defaultStageDrafts, replaceStages, type StageDraft } from '@/lib/dealStages'
import { TRIAL_DEAL_LIMIT, isTrialLimitError } from '@/lib/subscription'
import { queueDeal, shouldQueue } from '@/lib/capture'
import { StageEditor } from '@/components/deal/StageEditor'
import { getAllRatings, summarizeRatings } from '@/lib/reputation'
import { extractFromImage, extractFromTranscript, transcribeAudio } from '@/lib/aiIntake'
import type {
  Brand,
  BrandRating,
  DeliverableKind,
  ExtractedDealFields,
  ExtractedDeliverable,
  Platform as PlatformType,
} from '@/types'

/** Fallback line-item type when the brief wasn't itemised; mirrors DEFAULT_PLATFORM_FOR_KIND. */
const KIND_FOR_PLATFORM: Record<PlatformType, DeliverableKind> = {
  instagram_reel: 'reel',
  instagram_feed: 'static_post',
  instagram_story: 'story',
  youtube_short: 'yt_short',
  youtube_long: 'yt_long',
  twitter: 'other',
  linkedin: 'other',
  other: 'other',
}
import { PLATFORMS } from '@/constants/labels'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'
import { Chip, DateField, PressableScale, Sheet, TextField, useToast } from '@/components/ui'
import { replaceDeliverables, type DeliverableInput } from '@/lib/deliverables'
import { adRightsExpiry, adRightsPerMonth } from '@/lib/deliverables'
import { DEFAULT_PLATFORM_FOR_KIND } from '@/constants/labels'

// Returns null for blank input; validates YYYY-MM-DD format before saving.
function parseDate(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [year, month, day] = trimmed.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  if (isNaN(d.getTime()) || d.getMonth() !== month - 1) return null
  return trimmed
}

export default function NewDealScreen() {
  const toast = useToast()
  const router = useRouter()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [brands, setBrands] = useState<Brand[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [ratings, setRatings] = useState<BrandRating[]>([])

  // Form state
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [platform, setPlatform] = useState<PlatformType | null>(null)
  const [deliverable, setDeliverable] = useState('')
  const [rate, setRate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [stageDrafts, setStageDrafts] = useState<StageDraft[]>(defaultStageDrafts)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Retainer (§8.15). Turns this deal into month one of a contract and
  // generates the rest, rather than making her log twelve near-identical deals.
  const [retainerEnabled, setRetainerEnabled] = useState(false)
  const [retainerMonths, setRetainerMonths] = useState<number | null>(null)
  const [retainerPerPeriod, setRetainerPerPeriod] = useState('')

  // Ad rights (optional add-on term, not part of the base deal fields).
  const [adRightsEnabled, setAdRightsEnabled] = useState(false)
  const [adRightsFee, setAdRightsFee] = useState('')
  const [adRightsDuration, setAdRightsDuration] = useState<number | null>(null)
  const [adRightsStartDate, setAdRightsStartDate] = useState('')

  // AI intake state. `extracting` drives the loading banner/disabled state
  // shared by both the screenshot and voice paths (PRODUCT.md 2.1: one
  // review step, three entry points).
  const [extracting, setExtracting] = useState<'screenshot' | 'voice' | null>(null)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [repeatOptions, setRepeatOptions] = useState<RepeatCandidate[]>([])
  // Set when extraction returns a brand name that doesn't match any existing
  // brand, so we can prompt to create it and auto-select it once it exists.
  const [pendingBrandName, setPendingBrandName] = useState<string | null>(null)

  // Itemised breakdown the extraction returned, if any. Held aside rather than
  // rendered as editable rows here. Intake stays a single fast form, and the
  // deal screen's Deliverables card is where the breakdown gets adjusted.
  const [extractedItems, setExtractedItems] = useState<ExtractedDeliverable[]>([])

  // Live ad-rights maths, mirroring the deal screen's line-item editor.
  // The rate as typed so far, for the contract-total preview. Separate from the
  // parsed value in the submit handler, which validates rather than previews.
  const rateNumPreview = parseInt(rate, 10) || 0
  const perMonthAdRights = adRightsPerMonth(Number(adRightsFee) || 0, adRightsDuration)
  const adRightsExpiryPreview = adRightsExpiry(adRightsStartDate || null, adRightsDuration)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder)

  // Re-fetch brands when this screen gains focus so a newly created brand
  // (from brand/new.tsx, including one created to resolve pendingBrandName)
  // appears here immediately when the user navigates back.
  // Fetched independently: ratings depends on migration 006 (a newer,
  // separate table), so it being unavailable shouldn't block brand selection
  // itself, which has worked since migration 001.
  const loadBrands = useCallback(async () => {
    setBrandsLoading(true)
    try {
      setBrands(await getBrands())
    } catch {
      // Non-fatal: brands section shows an appropriate empty state.
    }
    try {
      setRatings(await getAllRatings())
    } catch {
      // Non-fatal: rows just render without a rating badge until this succeeds.
    } finally {
      setBrandsLoading(false)
    }
  }, [])

  // useFocusEffect requires a sync callback. Async functions return a Promise,
  // which the hook misinterprets as a cleanup function and throws. Wrap the
  // async call so the outer callback returns void.
  useFocusEffect(
    useCallback(() => {
      loadBrands()
    }, [loadBrands])
  )

  // Once brands reload with a name matching a pending AI-extracted brand,
  // auto-select it instead of leaving the creator to find it manually.
  useEffect(() => {
    if (!pendingBrandName) return
    const match = brands.find(
      (b) => b.name.trim().toLowerCase() === pendingBrandName.trim().toLowerCase()
    )
    if (match) {
      setSelectedBrandId(match.id)
      setPendingBrandName(null)
    }
  }, [brands, pendingBrandName])

  // Applies whatever the AI extraction returned onto the form fields. Every
  // field stays editable afterwards; this never saves on its own.
  function applyExtractedFields(fields: ExtractedDealFields) {
    const hasAnyField = Object.values(fields).some((v) => v !== null)
    if (!hasAnyField) {
      toast("Couldn't find deal details there. Try again, or fill in the form manually", { tone: 'error' })
      return
    }

    if (fields.deliverables?.length) setExtractedItems(fields.deliverables)
    if (fields.deliverable_description) setDeliverable(fields.deliverable_description)
    if (fields.rate) setRate(String(fields.rate))
    if (fields.payment_terms) setPaymentTerms(fields.payment_terms)
    // The extractor's schema is exactly the four default stages, so its dates
    // map onto them by position. A date it did not find leaves that stage's
    // existing value alone rather than clearing it, so re-running extraction
    // over a partly filled form never deletes what the creator already typed.
    const extractedDates = [
      fields.script_due_date,
      fields.shoot_date,
      fields.edit_done_date,
      fields.publish_date,
    ]
    if (extractedDates.some(Boolean)) {
      setStageDrafts((prev) =>
        prev.map((stage, index) => ({ ...stage, due_date: extractedDates[index] ?? stage.due_date }))
      )
    }
    if (fields.notes) setNotes(fields.notes)
    if (fields.platform) setPlatform(fields.platform)

    if (fields.brand_name) {
      const match = brands.find(
        (b) => b.name.trim().toLowerCase() === fields.brand_name!.trim().toLowerCase()
      )
      if (match) {
        setSelectedBrandId(match.id)
        setPendingBrandName(null)
      } else {
        setPendingBrandName(fields.brand_name)
      }
    }
  }

  async function handleScanScreenshot() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) {
      toast('Allow photo library access to scan a screenshot', { tone: 'warning' })
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    })
    if (result.canceled || !result.assets?.[0]?.base64) return

    setExtracting('screenshot')
    try {
      const asset = result.assets[0]
      const fields = await extractFromImage(asset.base64!, asset.mimeType || 'image/jpeg')
      applyExtractedFields(fields)
    } catch {
      toast('Please try again or enter the deal manually', { tone: 'error' })
    } finally {
      setExtracting(null)
    }
  }

  async function handleStartRecording() {
    const { granted } = await requestRecordingPermissionsAsync()
    if (!granted) {
      toast('Allow microphone access to record a voice note', { tone: 'warning' })
      return
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()
  }

  async function handleStopRecording() {
    await recorder.stop()
    const uri = recorder.uri
    if (!uri) {
      toast('Please try again', { tone: 'error' })
      return
    }

    setExtracting('voice')
    try {
      const base64 = await new File(uri).base64()
      const transcript = await transcribeAudio(base64, 'audio/m4a')
      const fields = await extractFromTranscript(transcript)
      applyExtractedFields(fields)
    } catch {
      toast('Please try again or enter the deal manually', { tone: 'error' })
    } finally {
      setExtracting(null)
    }
  }

  /**
   * Fills the form from a previous deal with the same brand.
   *
   * Copies the TERMS only: brand, platform, deliverable, rate, payment terms.
   * Deliberately not the dates, live link, notes or attachments — those belong
   * to the job rather than the arrangement, and copying them produces a deal
   * that claims it published last month.
   */
  function applyRepeat(candidate: RepeatCandidate) {
    setSelectedBrandId(candidate.brandId)
    setPlatform(candidate.platform)
    setDeliverable(candidate.deliverable)
    setRate(String(candidate.rate))
    if (candidate.paymentTerms) setPaymentTerms(candidate.paymentTerms)
    setStageDrafts(defaultStageDrafts())
    setRepeatOpen(false)
    toast(`Filled from your last ${candidate.brandName} deal`)
  }

  async function handleSave() {
    if (!selectedBrandId) {
      toast('Select a brand for this deal', { tone: 'warning' })
      return
    }
    if (!platform) {
      toast('Select a platform', { tone: 'warning' })
      return
    }
    if (!deliverable.trim()) {
      toast('Describe what you are delivering', { tone: 'warning' })
      return
    }
    const rateNum = parseInt(rate, 10)
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      toast('Enter a valid rate in INR', { tone: 'warning' })
      return
    }

    const retainerPerPeriodNum = parseInt(retainerPerPeriod, 10)
    if (retainerEnabled) {
      if (!retainerMonths) {
        toast('How many months does the retainer run?', { tone: 'warning' })
        return
      }
      if (!retainerPerPeriod || isNaN(retainerPerPeriodNum) || retainerPerPeriodNum <= 0) {
        toast('How many deliverables a month?', { tone: 'warning' })
        return
      }
    }

    setSaving(true)
    try {
      // ── Offline: remember it, and say so ────────────────────────────────────
      // §8.19's moment — a shoot, a basement studio, no signal. The queue takes
      // the deal and its stages together, because half a deal arriving is worse
      // than none and a deal with no stages has no deadlines to remind her of.
      //
      // Line items, ad rights and the retainer series are deliberately not
      // queued: §8.19 scopes offline to capture, and those are refinements she
      // makes sitting down. They stay editable on the deal once it syncs.
      if (await shouldQueue()) {
        await queueDeal(
          {
            brand_id: selectedBrandId,
            platform,
            deliverable_description: deliverable.trim(),
            rate: rateNum,
            payment_terms: paymentTerms.trim() || null,
            publish_date: stageDrafts[stageDrafts.length - 1]?.due_date ?? null,
            notes: notes.trim() || null,
          },
          stageDrafts,
          brands.find((b) => b.id === selectedBrandId)?.name ?? 'New deal'
        )
        toast('Saved on this phone. It will sync when you have signal.')
        router.back()
        return
      }

      const created = await createDeal({
        brand_id: selectedBrandId,
        platform,
        deliverable_description: deliverable.trim(),
        rate: rateNum,
        payment_terms: paymentTerms.trim() || null,
        // Only to derive the payment due date; the schedule itself is written
        // to deal_stages below.
        publish_date: stageDrafts[stageDrafts.length - 1]?.due_date ?? null,
        notes: notes.trim() || null,
        ad_rights: adRightsEnabled
          ? {
              ad_rights_granted: true,
              ad_rights_fee: parseInt(adRightsFee, 10),
              ad_rights_duration_months: adRightsDuration,
              ad_rights_start_date: parseDate(adRightsStartDate),
            }
          : null,
        // Records the contract terms on month one. The remaining months are
        // generated below, once this deal's stages and line items exist to be
        // copied from.
        retainer:
          retainerEnabled && retainerMonths
            ? { months: retainerMonths, perPeriod: retainerPerPeriodNum }
            : null,
      })

      // The stages themselves. createDeal only writes the legacy date columns,
      // so without this a brand-new deal would carry no stages at all and
      // every screen asking "what is next" would have nothing to read.
      await replaceStages(created.id, stageDrafts)
      await rescheduleWorkflow(created)

      // Line items. When the AI itemised the brief ("reel + 2 stories"), each
      // becomes its own row; otherwise the single deliverable field becomes
      // one row so every deal has line items from the moment it is created
      // and the deal screen never opens on an empty Deliverables card.
      const items: DeliverableInput[] = []

      if (extractedItems.length > 0) {
        // Rates are only split out when the brief priced each line. Where it
        // gave one total, the first row carries it and the rest are zero, so
        // the sum still matches what the creator agreed to.
        const priced = extractedItems.some((item) => item.rate != null)
        for (const [index, item] of extractedItems.entries()) {
          items.push({
            kind: item.kind,
            platform: DEFAULT_PLATFORM_FOR_KIND[item.kind],
            quantity: item.quantity,
            description: item.description,
            rate: priced ? (item.rate ?? 0) : index === 0 ? rateNum : 0,
          })
        }
      } else {
        items.push({
          kind: KIND_FOR_PLATFORM[platform],
          platform,
          quantity: 1,
          description: deliverable.trim(),
          rate: rateNum,
          due_date: stageDrafts[stageDrafts.length - 1]?.due_date ?? null,
        })
      }

      if (adRightsEnabled) {
        const startsOn = parseDate(adRightsStartDate)
        items.push({
          kind: 'ad_rights',
          quantity: 1,
          description: 'Paid amplification / whitelisting rights',
          rate: parseInt(adRightsFee, 10),
          duration_months: adRightsDuration,
          starts_on: startsOn,
          expires_on: adRightsExpiry(startsOn, adRightsDuration),
        })
      }

      try {
        await replaceDeliverables(created.id, items)
      } catch {
        // The deal itself saved. Losing the line-item breakdown is recoverable
        // from the deal screen, so it must not fail the whole intake.
      }

      // Last, because each generated month is a copy of this one and both the
      // stages and the line items above have to exist first. Not swallowed
      // like the line items are: a retainer that quietly saved as a single
      // month is the one outcome this toggle exists to prevent, so the failure
      // reaches the toast below.
      if (retainerEnabled && retainerMonths) {
        await generateRetainerMonths(created, {
          months: retainerMonths,
          perPeriod: retainerPerPeriodNum,
        })
      }

      router.back()
    } catch (error) {
      // The trial cap is a deliberate refusal, not a failure. Saying "try
      // again" would send her round the same loop until she gave up.
      toast(
        isTrialLimitError(error)
          ? `Your trial covers ${TRIAL_DEAL_LIMIT} deals. Subscribe from Settings to add more.`
          : 'Could not save deal. Please try again',
        { tone: isTrialLimitError(error) ? 'warning' : 'error' }
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalSheet title="Add deal">
    <SafeAreaView
      style={[styles.safe, { backgroundColor: c.bgPage }]}
      edges={['bottom']}
    >
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
          {/*
            Pressable wraps the entire form so tapping any non-interactive area
            (section labels, gaps between fields) calls Keyboard.dismiss().
            Buttons and TextInputs absorb their own touches via the RN responder
            system, so this only fires on background taps, so it doesn't interfere
            with form interactions.
          */}
          <Pressable onPress={() => Keyboard.dismiss()}>
          {/* ── AI intake ─────────────────────────────────────── */}
          {/*
            Three entry points into one shared review step below (PRODUCT.md
            2.1): scan a screenshot, record a voice note, or just start typing.
            Extraction only fills fields. Nothing saves until "Save deal".
          */}
          <View style={styles.intakeRow}>
            <TouchableOpacity
              style={[
                styles.intakeButton,
                { backgroundColor: c.bgSurface },
                extracting !== null && styles.intakeButtonDisabled,
              ]}
              onPress={handleScanScreenshot}
              disabled={extracting !== null || recorderState.isRecording}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={17} color={c.textPrimary} />
              <Text style={[styles.intakeButtonText, { color: c.textPrimary }]}>
                Scan screenshot
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.intakeButton,
                recorderState.isRecording
                  ? { backgroundColor: c.fillPrimary }
                  : { backgroundColor: c.bgSurface },
                extracting !== null && !recorderState.isRecording && styles.intakeButtonDisabled,
              ]}
              onPress={recorderState.isRecording ? handleStopRecording : handleStartRecording}
              disabled={extracting !== null && !recorderState.isRecording}
              activeOpacity={0.7}
            >
              <Ionicons
                name={recorderState.isRecording ? 'stop-circle-outline' : 'mic-outline'}
                size={17}
                color={recorderState.isRecording ? c.onFillPrimary : c.textPrimary}
              />
              <Text
                style={[
                  styles.intakeButtonText,
                  { color: recorderState.isRecording ? c.onFillPrimary : c.textPrimary },
                ]}
              >
                {recorderState.isRecording ? 'Stop recording' : 'Record voice'}
              </Text>
            </TouchableOpacity>

            {/* The fourth way in. Not a duplicate button on every deal row:
                with ten deals on screen that cannot answer "which one". This
                is the moment she is actually thinking "same as last time". */}
            <TouchableOpacity
              style={[styles.intakeButton, { backgroundColor: c.bgSurface }]}
              onPress={() => setRepeatOpen(true)}
              disabled={extracting !== null || recorderState.isRecording}
              activeOpacity={0.7}
            >
              <Ionicons name="repeat-outline" size={17} color={c.textPrimary} />
              <Text style={[styles.intakeButtonText, { color: c.textPrimary }]}>Repeat</Text>
            </TouchableOpacity>
          </View>

          {extracting && (
            <View style={styles.extractingBanner}>
              <ActivityIndicator color={c.textMuted} />
              <Text style={[styles.extractingText, { color: c.textSecondary }]}>
                {extracting === 'screenshot'
                  ? 'Reading screenshot…'
                  : 'Transcribing and extracting…'}
              </Text>
            </View>
          )}

          {/* ── Brand ─────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Brand</Text>

          {brandsLoading ? (
            <ActivityIndicator color={c.textMuted} style={{ marginVertical: Spacing.md }} />
          ) : brands.length === 0 ? (
            <View style={[styles.noBrandsBox, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.noBrandsText, { color: c.textSecondary }]}>
                No brands yet. Add a client first.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/brand/new' as never)}
                style={styles.noBrandsLink}
                activeOpacity={0.7}
              >
                <Text style={[styles.noBrandsLinkText, { color: c.textPrimary }]}>
                  Add brand →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.brandList, { backgroundColor: c.bgSurface }]}>
              {brands.map((brand, index) => {
                const selected = brand.id === selectedBrandId
                const summary = summarizeRatings(ratings.filter((r) => r.brand_id === brand.id))
                return (
                  <TouchableOpacity
                    key={brand.id}
                    style={[
                      styles.brandRow,
                      { backgroundColor: c.bgSurface },
                      index < brands.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: c.border,
                      },
                    ]}
                    onPress={() => setSelectedBrandId(brand.id)}
                    activeOpacity={0.7}
                  >
                    {/* Radio indicator */}
                    <View
                      style={[
                        styles.radio,
                        selected
                          ? { borderColor: c.fillPrimary }
                          : { borderColor: 'transparent', backgroundColor: c.borderStrong },
                      ]}
                    >
                      {selected && (
                        <View
                          style={[styles.radioDot, { backgroundColor: c.fillPrimary }]}
                        />
                      )}
                    </View>
                    <Text style={[styles.brandRowText, { color: c.textPrimary }]}>
                      {brand.name}
                    </Text>
                    {summary ? (
                      <View style={[styles.brandRatingPill, { backgroundColor: c.accentLight }]}>
                        <Text style={[styles.brandRatingPillText, { color: c.accentText }]}>
                          {summary.averageRating.toFixed(1)}
                          {summary.lastPaidOnTime === false ? ' · paid late before' : ''}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                style={[
                  styles.brandRow,
                  styles.addBrandRow,
                  { backgroundColor: c.bgSurface },
                ]}
                onPress={() => router.push('/(app)/brand/new' as never)}
                activeOpacity={0.7}
              >
                <Text style={[styles.addBrandText, { color: c.textSecondary }]}>
                  + Add new brand
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {pendingBrandName && (
            <View style={[styles.pendingBrandBanner, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.pendingBrandText, { color: c.textSecondary }]}>
                Brand "{pendingBrandName}" isn't in your list yet.
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/(app)/brand/new?name=${encodeURIComponent(pendingBrandName)}` as never
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={[styles.pendingBrandLink, { color: c.textPrimary }]}>
                  Add "{pendingBrandName}" →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Platform ──────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Platform</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.platformScroll}
          >
            {PLATFORMS.map((p) => (
              <Chip
                key={p.key}
                label={p.label}
                selected={platform === p.key}
                onPress={() => setPlatform(p.key)}
              />
            ))}
          </ScrollView>

          {/* ── Deal details ──────────────────────────────────── */}
          <View style={styles.fieldStack}>
            <TextField
              label="Deliverable"
              placeholder="1 Reel + 3 Stories"
              value={deliverable}
              onChangeText={setDeliverable}
              multiline
              hint="You can break this into separate priced items after saving"
            />

            <TextField
              label="Rate"
              prefix="₹"
              placeholder="0"
              keyboardType="number-pad"
              value={rate}
              onChangeText={(v) => setRate(v.replace(/[^0-9]/g, ''))}
            />

            <TextField
              label="Payment terms"
              placeholder="45 days from publish"
              value={paymentTerms}
              onChangeText={setPaymentTerms}
            />
          </View>

          {/* ── Stages ────────────────────────────────────────────
              Starts with the four defaults because they fit most creators,
              and every one of them can be renamed, removed or added to. No
              field here says "optional": everything on this form can be left
              blank, so saying so on four of them implied the rest were not. */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Stages</Text>
          <View style={styles.dateFields}>
            <StageEditor stages={stageDrafts} onChange={setStageDrafts} allowDone={false} />
          </View>

          {/* ── Retainer (optional) ───────────────────────────── */}
          <View style={styles.adRightsHeader}>
            <Text style={[styles.sectionLabel, styles.adRightsLabel, { color: c.accentText }]}>
              Retainer
            </Text>
            <Switch
              value={retainerEnabled}
              onValueChange={setRetainerEnabled}
              trackColor={{ false: c.border, true: c.accentLight }}
              thumbColor={retainerEnabled ? c.accent : undefined}
            />
          </View>

          {retainerEnabled && (
            <View style={[styles.adRightsBox, { backgroundColor: c.accentLight }]}>
              <Text style={[styles.dateLabel, { color: c.textSecondary }]}>How many months</Text>
              <View style={styles.platformScroll}>
                {[3, 6, 9, 12].map((months) => (
                  <Chip
                    key={months}
                    label={`${months} months`}
                    selected={retainerMonths === months}
                    onPress={() => setRetainerMonths(months)}
                  />
                ))}
              </View>

              <View style={styles.adRightsDate}>
                <TextField
                  label="Deliverables a month"
                  placeholder="4"
                  keyboardType="number-pad"
                  value={retainerPerPeriod}
                  onChangeText={(v) => setRetainerPerPeriod(v.replace(/[^0-9]/g, ''))}
                />
              </View>

              {/* States plainly that the rate is per month and that this save
                  creates several deals, both of which are otherwise a surprise
                  the creator only discovers afterwards. */}
              {retainerMonths ? (
                <Text style={[styles.adRightsExpiryNote, { color: c.accentText }]}>
                  {retainerMonths} deals, one a month, each at the rate above
                  {rateNumPreview > 0
                    ? ` · ${formatCurrency(rateNumPreview * retainerMonths)} over the contract`
                    : ''}
                </Text>
              ) : null}
            </View>
          )}

          {/* ── Ad rights (optional) ──────────────────────────── */}
          <View style={styles.adRightsHeader}>
            <Text style={[styles.sectionLabel, styles.adRightsLabel, { color: c.accentText }]}>
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
            <View style={[styles.adRightsBox, { backgroundColor: c.accentLight }]}>
              <TextField
                label="Ad rights fee"
                prefix="₹"
                placeholder="0"
                keyboardType="number-pad"
                value={adRightsFee}
                onChangeText={(v) => setAdRightsFee(v.replace(/[^0-9]/g, ''))}
              />

              <Text style={[styles.dateLabel, { color: c.textSecondary, marginTop: Spacing.md }]}>
                Duration
              </Text>
              <View style={styles.platformScroll}>
                {[1, 2, 3, 6, 9, 12].map((months) => (
                  <Chip
                    key={months}
                    label={`${months} ${months === 1 ? 'month' : 'months'}`}
                    selected={adRightsDuration === months}
                    onPress={() => setAdRightsDuration(months)}
                  />
                ))}
              </View>

              <View style={styles.adRightsDate}>
                <DateField
                  label="Rights start"
                  value={adRightsStartDate || null}
                  onChange={(value) => setAdRightsStartDate(value ?? '')}
                  placeholder="Pick a start date"
                />
              </View>

              {/* Per-month value, the same figure the deal screen's ad-rights
                  line item shows; useful here while the rate is negotiable. */}
              {perMonthAdRights != null ? (
                <Text style={[styles.adRightsExpiryNote, { color: c.accentText }]}>
                  {formatCurrency(perMonthAdRights)} per month
                  {adRightsExpiryPreview
                    ? ` · ends ${formatDate(adRightsExpiryPreview)}`
                    : ''}
                </Text>
              ) : null}
            </View>
          )}

          {/* ── Notes ─────────────────────────────────────────── */}
          <View style={styles.fieldStack}>
            <TextField
              label="Notes"
              placeholder="Anything the chat missed: brief quirks, who to chase"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* ── Save ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.saveButtonText, { color: c.onFillPrimary }]}>
                Save deal
              </Text>
            )}
          </TouchableOpacity>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>

      {/* One row per brand, that brand's most recent deal. Ten deals across
          four brands is four rows, which is what makes this usable where a
          per-row duplicate button would not be. */}
      <Sheet visible={repeatOpen} onClose={() => setRepeatOpen(false)} title="Repeat a deal">
        {repeatOptions.length === 0 ? (
          <Text style={[styles.repeatEmpty, { color: c.textMuted }]}>
            Nothing to repeat yet. Once you have logged a deal, it shows up here.
          </Text>
        ) : (
          <View style={styles.repeatList}>
            {repeatOptions.map((candidate) => (
              <PressableScale
                key={candidate.dealId}
                onPress={() => applyRepeat(candidate)}
                accessibilityRole="button"
                accessibilityLabel={`Repeat the ${candidate.brandName} deal`}
                style={[styles.repeatRow, { backgroundColor: c.bgSurface }]}
              >
                <View style={styles.repeatText}>
                  <Text style={[styles.repeatBrand, { color: c.textPrimary }]} numberOfLines={1}>
                    {candidate.brandName}
                  </Text>
                  <Text style={[styles.repeatMeta, { color: c.textMuted }]} numberOfLines={1}>
                    {candidate.deliverable} · {formatCurrency(candidate.rate)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </PressableScale>
            ))}
          </View>
        )}
      </Sheet>

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
  repeatList: {
    gap: Spacing.sm,
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
  },
  repeatText: {
    flex: 1,
    gap: 2,
  },
  repeatBrand: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  repeatMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  repeatEmpty: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  // AI intake
  intakeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  intakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderRadius: Radius.full,
  },
  intakeButtonDisabled: {
    opacity: 0.5,
  },
  intakeButtonText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  extractingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  extractingText: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  pendingBrandBanner: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  pendingBrandText: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  pendingBrandLink: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  // Brand list
  noBrandsBox: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  noBrandsText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  noBrandsLink: {},
  noBrandsLinkText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  brandList: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: Spacing.sm,
  },
  addBrandRow: {
    borderTopWidth: 1,
  },
  brandRowText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    flex: 1,
  },
  brandRatingPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  brandRatingPillText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
  addBrandText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Platform picker
  platformScroll: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xxs,
  },
  // Rate
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
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  adRightsExpiryNote: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.sm,
  },
  // Timeline grid
  // DateField carries its own label, so these stack in one column rather than
  // the 2×2 grid the old bare inputs needed.
  // TextField brings its own label and spacing, so grouped fields just need
  // a consistent gap rather than the old label/input margin rhythm.
  fieldStack: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  dateFields: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  adRightsDate: {
    marginTop: Spacing.md,
  },
  dateLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  // Save button
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
