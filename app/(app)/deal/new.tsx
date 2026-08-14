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
import { createDeal } from '@/lib/deals'
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

/** Fallback line-item type when the brief wasn't itemised — mirrors DEFAULT_PLATFORM_FOR_KIND. */
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
import { Chip, DateField, TextField, useToast } from '@/components/ui'
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
  const [scriptDue, setScriptDue] = useState('')
  const [shootDate, setShootDate] = useState('')
  const [editDone, setEditDone] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Ad rights (optional add-on term, not part of the base deal fields).
  const [adRightsEnabled, setAdRightsEnabled] = useState(false)
  const [adRightsFee, setAdRightsFee] = useState('')
  const [adRightsDuration, setAdRightsDuration] = useState<number | null>(null)
  const [adRightsStartDate, setAdRightsStartDate] = useState('')

  // AI intake state. `extracting` drives the loading banner/disabled state
  // shared by both the screenshot and voice paths (PRODUCT.md 2.1 — one
  // review step, three entry points).
  const [extracting, setExtracting] = useState<'screenshot' | 'voice' | null>(null)
  // Set when extraction returns a brand name that doesn't match any existing
  // brand, so we can prompt to create it and auto-select it once it exists.
  const [pendingBrandName, setPendingBrandName] = useState<string | null>(null)

  // Itemised breakdown the extraction returned, if any. Held aside rather than
  // rendered as editable rows here — intake stays a single fast form, and the
  // deal screen's Deliverables card is where the breakdown gets adjusted.
  const [extractedItems, setExtractedItems] = useState<ExtractedDeliverable[]>([])

  // Live ad-rights maths, mirroring the deal screen's line-item editor.
  const perMonthAdRights = adRightsPerMonth(Number(adRightsFee) || 0, adRightsDuration)
  const adRightsExpiryPreview = adRightsExpiry(adRightsStartDate || null, adRightsDuration)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder)

  // Re-fetch brands when this screen gains focus so a newly created brand
  // (from brand/new.tsx, including one created to resolve pendingBrandName)
  // appears here immediately when the user navigates back.
  // Fetched independently — ratings depends on migration 006 (a newer,
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

  // useFocusEffect requires a sync callback — async functions return a Promise,
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
  // field stays editable afterwards — this never saves on its own.
  function applyExtractedFields(fields: ExtractedDealFields) {
    const hasAnyField = Object.values(fields).some((v) => v !== null)
    if (!hasAnyField) {
      toast("Couldn't find deal details there — try again or fill in the form manually", { tone: 'error' })
      return
    }

    if (fields.deliverables?.length) setExtractedItems(fields.deliverables)
    if (fields.deliverable_description) setDeliverable(fields.deliverable_description)
    if (fields.rate) setRate(String(fields.rate))
    if (fields.payment_terms) setPaymentTerms(fields.payment_terms)
    if (fields.script_due_date) setScriptDue(fields.script_due_date)
    if (fields.shoot_date) setShootDate(fields.shoot_date)
    if (fields.edit_done_date) setEditDone(fields.edit_done_date)
    if (fields.publish_date) setPublishDate(fields.publish_date)
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

    // Validate any dates that were entered.
    const datesToValidate = [
      { label: 'Script due date', value: scriptDue },
      { label: 'Shoot date', value: shootDate },
      { label: 'Edit done date', value: editDone },
      { label: 'Publish date', value: publishDate },
    ]
    for (const { label, value } of datesToValidate) {
      if (value.trim() && parseDate(value) === null) {
        // Defensive only — every date on this screen now comes from the
        // calendar picker, so an unparseable one would mean a bug, not typing.
        toast(`${label} isn't a valid date`, { tone: 'warning' })
        return
      }
    }

    if (adRightsEnabled) {
      const feeNum = parseInt(adRightsFee, 10)
      if (!adRightsFee || isNaN(feeNum) || feeNum <= 0) {
        toast('Enter the ad rights fee, or turn off ad rights', { tone: 'warning' })
        return
      }
      if (!adRightsDuration) {
        toast('Select how long the ad rights last', { tone: 'warning' })
        return
      }
      if (!adRightsStartDate.trim() || parseDate(adRightsStartDate) === null) {
        toast('Enter a valid start date (YYYY-MM-DD)', { tone: 'warning' })
        return
      }
    }

    setSaving(true)
    try {
      const created = await createDeal({
        brand_id: selectedBrandId,
        platform,
        deliverable_description: deliverable.trim(),
        rate: rateNum,
        payment_terms: paymentTerms.trim() || null,
        script_due_date: parseDate(scriptDue),
        shoot_date: parseDate(shootDate),
        edit_done_date: parseDate(editDone),
        publish_date: parseDate(publishDate),
        notes: notes.trim() || null,
        ad_rights: adRightsEnabled
          ? {
              ad_rights_granted: true,
              ad_rights_fee: parseInt(adRightsFee, 10),
              ad_rights_duration_months: adRightsDuration,
              ad_rights_start_date: parseDate(adRightsStartDate),
            }
          : null,
      })

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
          due_date: parseDate(publishDate),
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

      router.back()
    } catch {
      toast('Could not save deal. Please try again', { tone: 'error' })
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
            system, so this only fires on background taps — it doesn't interfere
            with form interactions.
          */}
          <Pressable onPress={() => Keyboard.dismiss()}>
          {/* ── AI intake ─────────────────────────────────────── */}
          {/*
            Three entry points into one shared review step below (PRODUCT.md
            2.1): scan a screenshot, record a voice note, or just start typing.
            Extraction only fills fields — nothing saves until "Save deal".
          */}
          <View style={styles.intakeRow}>
            <TouchableOpacity
              style={[
                styles.intakeButton,
                { borderColor: c.borderStrong },
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
                  ? { backgroundColor: c.fillPrimary, borderColor: c.fillPrimary }
                  : { borderColor: c.borderStrong },
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
            <View style={[styles.noBrandsBox, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
              <Text style={[styles.noBrandsText, { color: c.textSecondary }]}>
                No brands yet — add a client first.
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
            <View style={[styles.brandList, { borderColor: c.border }]}>
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
                        {
                          borderColor: selected ? c.fillPrimary : c.borderStrong,
                        },
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
            <View style={[styles.pendingBrandBanner, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
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

          {/* ── Timeline ──────────────────────────────────────────
              Real date pickers. These were four bare TextInputs asking the
              creator to hand-type "2025-09-01" — the worst input pattern in
              an app whose first promise is that she never misses a deadline. */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Timeline</Text>
          <View style={styles.dateFields}>
            <DateField
              label="Script"
              value={scriptDue || null}
              onChange={(value) => setScriptDue(value ?? '')}
              placeholder="Optional"
            />
            <DateField
              label="Shoot"
              value={shootDate || null}
              onChange={(value) => setShootDate(value ?? '')}
              placeholder="Optional"
            />
            <DateField
              label="Edit"
              value={editDone || null}
              onChange={(value) => setEditDone(value ?? '')}
              placeholder="Optional"
            />
            <DateField
              label="Publish"
              value={publishDate || null}
              onChange={(value) => setPublishDate(value ?? '')}
              placeholder="Optional"
            />
          </View>

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
            <View style={[styles.adRightsBox, { backgroundColor: c.accentLight, borderColor: c.accent }]}>
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
                  line item shows — useful here while the rate is negotiable. */}
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
              placeholder="Anything the chat didn't capture — brief quirks, who to chase"
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
    borderWidth: 1,
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
    borderWidth: 1,
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
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  // Brand list
  noBrandsBox: {
    borderWidth: 1,
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
    borderWidth: 1,
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
    paddingBottom: 2,
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
