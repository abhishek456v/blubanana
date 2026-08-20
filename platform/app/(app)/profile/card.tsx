import { useCallback, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import {
  cardIsThin,
  getProfileCardData,
  missingRateKinds,
  suggestMissingRates,
  toCardContent,
  type ProfileCardData,
} from '@/lib/profileCard'
import { buildProfileCardHtml, type CardContent } from '@/lib/profileCardHtml'
import {
  MAX_PROFILE_PHOTOS,
  deleteProfilePhoto,
  getProfilePhotos,
  photoAsDataUri,
  setCardPhoto,
  uploadProfilePhoto,
  type ProfilePhoto,
} from '@/lib/profilePhotos'
import { getProfile, updateProfile } from '@/lib/profile'
import { sharePdf } from '@/lib/sharePdf'
import { CARD_THEMES, resolveTheme, type CardTheme } from '@/constants/cardThemes'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { ModalSheet } from '@/components/ModalSheet'
import { CardEditorSheet } from '@/components/profile/CardEditorSheet'
import {
  Button,
  Chip,
  EmptyState,
  PressableScale,
  RevealScrollView,
  Skeleton,
  useConfirm,
  useToast,
} from '@/components/ui'

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * The shareable card (§8.11) — what a creator sends when a brand says "share
 * your commercials".
 *
 * Three things are hers to control and they behave differently on purpose:
 *
 *   * The **photo** and the **theme** persist. They are assets and a
 *     preference, chosen once and reused.
 *   * The **text** does not. Every field is editable before sending, and the
 *     card is rebuilt from live data next time it opens, so a figure adjusted
 *     for one negotiation cannot follow her into a later one silently.
 *
 * The preview below is a native rendering of the same content the document
 * uses. Two renderers of one dataset can drift, so both are fed from the same
 * `CardContent` and the same theme rather than being designed twice.
 */
export default function ProfileCardScreen() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const toast = useToast()
  const confirm = useConfirm()

  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<CardContent | null>(null)
  const [theme, setTheme] = useState<CardTheme>(CARD_THEMES[0])
  const [photos, setPhotos] = useState<ProfilePhoto[]>([])
  const [cardPhotoId, setCardPhotoId] = useState<string | null>(null)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [thin, setThin] = useState(false)
  // Kept so the editor can ask for suggestions against the real figures rather
  // than against whatever she has already edited on the card.
  const [derived, setDerived] = useState<ProfileCardData | null>(null)

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, profile, saved] = await Promise.all([
        getProfileCardData(),
        getProfile(),
        getProfilePhotos(),
      ])

      setContent(toCardContent(data))
      setDerived(data)
      setThin(cardIsThin(data))
      setTheme(resolveTheme(profile?.card_theme, profile?.niche))
      setPhotos(saved)

      const chosen =
        saved.find((p) => p.id === profile?.card_photo_id) ?? saved[0] ?? null
      setCardPhotoId(chosen?.id ?? null)
      setPhotoUri(chosen ? await photoAsDataUri(chosen.path) : null)
    } catch {
      toast('Could not build your card', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function handlePickTheme(next: CardTheme) {
    setTheme(next)
    try {
      await updateProfile({ card_theme: next.key })
    } catch {
      // The card still uses the choice for this session; only the memory of it
      // failed, which is not worth interrupting her to say.
    }
  }

  async function handleChoosePhoto(photo: ProfilePhoto) {
    setCardPhotoId(photo.id)
    setPhotoUri(await photoAsDataUri(photo.path))
    try {
      await setCardPhoto(photo.id)
    } catch {
      toast('Could not save that choice', { tone: 'error' })
    }
  }

  async function handleAddPhoto() {
    if (photos.length >= MAX_PROFILE_PHOTOS) {
      toast(`You can keep up to ${MAX_PROFILE_PHOTOS} photos. Remove one first.`, {
        tone: 'warning',
      })
      return
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast('Photo access is needed to add a picture', { tone: 'warning' })
      return
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Square, because the card crops to a circle. Letting her frame it here
      // is the difference between a portrait and a cropped-off forehead.
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    })
    if (picked.canceled || !picked.assets[0]?.base64) return

    setBusy(true)
    try {
      const photo = await uploadProfilePhoto(picked.assets[0].base64)
      setPhotos((prev) => [...prev, photo])
      await handleChoosePhoto(photo)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not add that photo', {
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemovePhoto(photo: ProfilePhoto) {
    const ok = await confirm({
      title: 'Remove this photo?',
      message: 'It is deleted from your account, not just from the card.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return

    try {
      await deleteProfilePhoto(photo)
      const remaining = photos.filter((p) => p.id !== photo.id)
      setPhotos(remaining)
      if (cardPhotoId === photo.id) {
        const next = remaining[0] ?? null
        setCardPhotoId(next?.id ?? null)
        setPhotoUri(next ? await photoAsDataUri(next.path) : null)
        await setCardPhoto(next?.id ?? null)
      }
    } catch {
      toast('Could not remove that photo', { tone: 'error' })
    }
  }

  async function handleShare() {
    if (!content || busy) return
    setBusy(true)
    try {
      await sharePdf(buildProfileCardHtml({ content, theme, photoDataUri: photoUri }), 'Rate card')
    } catch {
      toast('Could not share your card', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Rate card" wide>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>
            <Skeleton height={280} radius={Radius.lg} />
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  if (!content || thin) {
    return (
      <ModalSheet title="Rate card" wide>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>
            <EmptyState
              icon="id-card-outline"
              title="Not enough history yet"
              message="Your card is built from what you have actually charged. Log a few deals with their line items and it fills itself in."
            />
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  // The front face.
  const front = (
  <LinearGradient
    colors={theme.front.colors as [string, string, ...string[]]}
    locations={theme.front.locations as [number, number, ...number[]]}
    start={{ x: 0.1, y: 0 }}
    end={{ x: 0.9, y: 1 }}
    style={styles.panel}
  >
    <View style={[styles.portrait, { borderColor: 'rgba(255,255,255,0.42)' }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.portraitImage} />
      ) : (
        <Text style={[styles.monogram, { color: theme.ink }]}>
          {monogram(content.name)}
        </Text>
      )}
    </View>

    <Text style={[styles.name, { color: theme.ink }]}>{content.name}</Text>
    {content.tagline ? (
      <Text style={[styles.tagline, { color: theme.inkSoft }]}>{content.tagline}</Text>
    ) : null}
    {content.handles ? (
      <Text style={[styles.handles, { color: theme.ink }]}>{content.handles}</Text>
    ) : null}

    <View style={styles.stats}>
      {content.stats
        .filter((s) => s.value.trim())
        .map((stat, i) => (
          <View key={i}>
            <Text style={[styles.statValue, { color: theme.ink }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.inkSoft }]}>{stat.label}</Text>
          </View>
        ))}
    </View>
  </LinearGradient>
  )

  // The back face: rates, about, contact.
  const back = (
  <LinearGradient
    colors={theme.back.colors as [string, string, ...string[]]}
    locations={theme.back.locations as [number, number, ...number[]]}
    start={{ x: 0.1, y: 0 }}
    end={{ x: 0.9, y: 1 }}
    style={styles.panel}
  >
    {content.rates.length > 0 ? (
      <>
        <Text style={[styles.sectionLabel, { color: theme.inkSoft }]}>
          {content.ratesHeading}
        </Text>
        {content.rates.map((rate, i) => (
          <View key={i} style={styles.rateRow}>
            <Text style={[styles.rateLabel, { color: theme.ink }]}>{rate.label}</Text>
            <Text style={[styles.rateValue, { color: theme.ink }]}>{rate.value}</Text>
          </View>
        ))}
      </>
    ) : null}

    {content.about ? (
      <Text style={[styles.about, { color: theme.inkSoft }]}>{content.about}</Text>
    ) : null}

    {content.contact ? (
      <>
        <Text style={[styles.sectionLabel, { color: theme.inkSoft, marginTop: Spacing.md }]}>
          {content.contactHeading}
        </Text>
        <Text style={[styles.contact, { color: theme.ink }]}>{content.contact}</Text>
      </>
    ) : null}
  </LinearGradient>
  )

  const controls = (
    <>
      {/* Photo */}
      <Text style={[styles.controlLabel, { color: c.textSecondary }]}>Photo</Text>
      <View style={styles.photoRow}>
        {photos.map((photo) => (
          <PhotoThumb
            key={photo.id}
            photo={photo}
            selected={photo.id === cardPhotoId}
            onPress={() => handleChoosePhoto(photo)}
            onRemove={() => handleRemovePhoto(photo)}
          />
        ))}
        {photos.length < MAX_PROFILE_PHOTOS ? (
          <PressableScale
            onPress={handleAddPhoto}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            style={[styles.addPhoto, { backgroundColor: c.accentLight }]}
          >
            <Ionicons name="add" size={20} color={c.accent} />
          </PressableScale>
        ) : null}
      </View>

      {/* Theme */}
      <Text style={[styles.controlLabel, { color: c.textSecondary }]}>Theme</Text>
      <View style={styles.themeRow}>
        {CARD_THEMES.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={option.key === theme.key}
            onPress={() => handlePickTheme(option)}
          />
        ))}
      </View>

      <Text style={[styles.note, { color: c.textMuted }]}>
        Rates are the median of what you have actually charged, so the card stays
        current on its own. Edits below apply to this send only.
      </Text>

      <Button label="Edit card" variant="secondary" onPress={() => setEditing(true)} fullWidth />
      <Button
        label={busy ? 'Preparing…' : 'Share card'}
        onPress={handleShare}
        disabled={busy}
        fullWidth
      />
    </>
  )

  return (
    <ModalSheet title="Rate card" wide>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView
          contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          {isDesktop ? (
            <>
              <View style={styles.faces}>
                <View style={styles.face}>{front}</View>
                <View style={styles.face}>{back}</View>
              </View>
              {controls}
            </>
          ) : (
            <>
              {front}
              {back}
              {controls}
            </>
          )}
        </RevealScrollView>

        <CardEditorSheet
          visible={editing}
          content={content}
          onClose={() => setEditing(false)}
          onApply={setContent}
          // Absent rather than disabled when she already prices everything:
          // an offer that can only return nothing is worse than no offer.
          onRequestSuggestions={
            derived && missingRateKinds(derived).length > 0
              ? () => suggestMissingRates(derived)
              : undefined
          }
        />
      </SafeAreaView>
    </ModalSheet>
  )
}

function PhotoThumb({
  photo,
  selected,
  onPress,
  onRemove,
}: {
  photo: ProfilePhoto
  selected: boolean
  onPress: () => void
  onRemove: () => void
}) {
  const { c } = useTheme()
  const [uri, setUri] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      photoAsDataUri(photo.path).then((value) => active && setUri(value))
      return () => {
        active = false
      }
    }, [photo.path])
  )

  return (
    <View>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={selected ? 'Photo used on the card' : 'Use this photo on the card'}
        style={[
          styles.thumb,
          selected ? { borderColor: c.accent, borderWidth: 2 } : null,
        ]}
      >
        {uri ? <Image source={{ uri }} style={styles.thumbImage} /> : null}
      </PressableScale>
      <PressableScale
        onPress={onRemove}
        hitSlop={HitSlop}
        accessibilityRole="button"
        accessibilityLabel="Remove this photo"
        style={[styles.thumbRemove, { backgroundColor: c.bgSurface }]}
      >
        <Ionicons name="close" size={12} color={c.textMuted} />
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    width: '100%',
    alignSelf: 'center',
  },
  contentWide: {
    padding: Spacing.lg,
  },
  // The two faces of one card, shown the way it prints rather than as two
  // things to scroll between.
  faces: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  face: {
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'flex-start',
  },
  controlsCol: {
    flex: 1,
    gap: Spacing.sm,
  },
  panel: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  portrait: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  portraitImage: { width: '100%', height: '100%' },
  monogram: {
    ...Typography.title,
    fontFamily: FontFamily.semiBold,
  },
  name: {
    ...Typography.display,
    fontFamily: FontFamily.display,
    marginTop: Spacing.md,
  },
  tagline: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xs,
  },
  handles: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
    opacity: 0.9,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  statValue: {
    ...Typography.title,
    fontFamily: FontFamily.semiBold,
  },
  statLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  sectionLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.13)',
  },
  rateLabel: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    opacity: 0.88,
  },
  rateValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  about: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: Spacing.md,
  },
  contact: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xs,
  },
  controlLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  note: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
})
