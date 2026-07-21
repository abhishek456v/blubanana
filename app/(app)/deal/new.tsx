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
  useColorScheme,
  ActivityIndicator,
  Alert,
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
import { getBrands } from '@/lib/brands'
import { createDeal } from '@/lib/deals'
import { extractFromImage, extractFromTranscript, transcribeAudio } from '@/lib/aiIntake'
import type { Brand, ExtractedDealFields, Platform as PlatformType } from '@/types'
import { PLATFORMS } from '@/constants/labels'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { ModalSheet } from '@/components/ModalSheet'

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
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [brands, setBrands] = useState<Brand[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)

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

  // AI intake state. `extracting` drives the loading banner/disabled state
  // shared by both the screenshot and voice paths (PRODUCT.md 2.1 — one
  // review step, three entry points).
  const [extracting, setExtracting] = useState<'screenshot' | 'voice' | null>(null)
  // Set when extraction returns a brand name that doesn't match any existing
  // brand, so we can prompt to create it and auto-select it once it exists.
  const [pendingBrandName, setPendingBrandName] = useState<string | null>(null)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder)

  // Re-fetch brands when this screen gains focus so a newly created brand
  // (from brand/new.tsx, including one created to resolve pendingBrandName)
  // appears here immediately when the user navigates back.
  const loadBrands = useCallback(async () => {
    setBrandsLoading(true)
    try {
      const data = await getBrands()
      setBrands(data)
    } catch {
      // Non-fatal: brands section shows an appropriate empty state.
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
      Alert.alert(
        'Nothing extracted',
        "Couldn't find deal details there — try again or fill in the form manually."
      )
      return
    }

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
      Alert.alert('Photo access needed', 'Allow photo library access to scan a screenshot.')
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
      Alert.alert(
        'Could not read screenshot',
        'Please try again or enter the deal manually.'
      )
    } finally {
      setExtracting(null)
    }
  }

  async function handleStartRecording() {
    const { granted } = await requestRecordingPermissionsAsync()
    if (!granted) {
      Alert.alert('Microphone access needed', 'Allow microphone access to record a voice note.')
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
      Alert.alert('Recording failed', 'Please try again.')
      return
    }

    setExtracting('voice')
    try {
      const base64 = await new File(uri).base64()
      const transcript = await transcribeAudio(base64, 'audio/m4a')
      const fields = await extractFromTranscript(transcript)
      applyExtractedFields(fields)
    } catch {
      Alert.alert(
        'Could not process voice note',
        'Please try again or enter the deal manually.'
      )
    } finally {
      setExtracting(null)
    }
  }

  const inputStyle = [
    styles.input,
    {
      borderColor: c.borderStrong,
      color: c.textPrimary,
      backgroundColor: c.bgSurface,
    },
  ]

  async function handleSave() {
    if (!selectedBrandId) {
      Alert.alert('Brand required', 'Select a brand for this deal.')
      return
    }
    if (!platform) {
      Alert.alert('Platform required', 'Select a platform.')
      return
    }
    if (!deliverable.trim()) {
      Alert.alert('Deliverable required', 'Describe what you are delivering.')
      return
    }
    const rateNum = parseInt(rate, 10)
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      Alert.alert('Rate required', 'Enter a valid rate in INR.')
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
        Alert.alert('Invalid date', `${label} must be in YYYY-MM-DD format (e.g. 2025-09-15).`)
        return
      }
    }

    setSaving(true)
    try {
      await createDeal({
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
      })
      router.back()
    } catch {
      Alert.alert('Error', 'Could not save deal. Please try again.')
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

          {/* ── Deal details ──────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Deliverable</Text>
          <TextInput
            style={[inputStyle, styles.multiline]}
            placeholder="What are you creating? e.g. 1 Instagram Reel + 3 Stories"
            placeholderTextColor={c.textMuted}
            value={deliverable}
            onChangeText={setDeliverable}
            multiline
            textAlignVertical="top"
          />

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Rate</Text>
          <View style={styles.rateRow}>
            <View
              style={[
                styles.ratePrefix,
                {
                  borderColor: c.borderStrong,
                  backgroundColor: c.bgSurface,
                },
              ]}
            >
              <Text style={[styles.ratePrefixText, { color: c.textMuted }]}>₹</Text>
            </View>
            <TextInput
              style={[
                styles.rateInput,
                {
                  borderColor: c.borderStrong,
                  color: c.textPrimary,
                  backgroundColor: c.bgSurface,
                },
              ]}
              placeholder="0"
              placeholderTextColor={c.textMuted}
              value={rate}
              onChangeText={(v) => setRate(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
            Payment terms
          </Text>
          <TextInput
            style={inputStyle}
            placeholder='e.g. "45 days from publish"'
            placeholderTextColor={c.textMuted}
            value={paymentTerms}
            onChangeText={setPaymentTerms}
          />

          {/* ── Timeline ──────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
            Timeline (optional — YYYY-MM-DD)
          </Text>
          <View style={styles.dateGrid}>
            <View style={styles.dateCell}>
              <Text style={[styles.dateLabel, { color: c.textMuted }]}>Script due</Text>
              <TextInput
                style={inputStyle}
                placeholder="2025-09-01"
                placeholderTextColor={c.textMuted}
                value={scriptDue}
                onChangeText={setScriptDue}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.dateCell}>
              <Text style={[styles.dateLabel, { color: c.textMuted }]}>Shoot day</Text>
              <TextInput
                style={inputStyle}
                placeholder="2025-09-05"
                placeholderTextColor={c.textMuted}
                value={shootDate}
                onChangeText={setShootDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.dateCell}>
              <Text style={[styles.dateLabel, { color: c.textMuted }]}>Edit done</Text>
              <TextInput
                style={inputStyle}
                placeholder="2025-09-10"
                placeholderTextColor={c.textMuted}
                value={editDone}
                onChangeText={setEditDone}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.dateCell}>
              <Text style={[styles.dateLabel, { color: c.textMuted }]}>Publish date</Text>
              <TextInput
                style={inputStyle}
                placeholder="2025-09-15"
                placeholderTextColor={c.textMuted}
                value={publishDate}
                onChangeText={setPublishDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {/* ── Notes ─────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Notes</Text>
          <TextInput
            style={[inputStyle, styles.multiline]}
            placeholder="Any context that didn't come through above"
            placeholderTextColor={c.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

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
  multiline: {
    height: undefined,
    minHeight: 88,
    paddingTop: 11,
    paddingBottom: 11,
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
  platformPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  platformPillText: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  // Rate
  rateRow: {
    flexDirection: 'row',
    gap: 0,
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
