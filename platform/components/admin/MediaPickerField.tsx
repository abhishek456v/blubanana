import { useCallback, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { listMedia, uploadMedia, type MediaFolder, type MediaItem } from '@/lib/admin'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Button, EmptyState, PressableScale, Sheet, useToast } from '@/components/ui'

export interface MediaPickerFieldProps {
  label: string
  hint?: string
  /** The chosen picture's address, or null. */
  value: string | null
  onChange: (url: string | null) => void
  /** Where a newly uploaded file is filed. */
  folder?: MediaFolder
}

/**
 * Choose a picture, from the library or from this device.
 *
 * Replaces a text field that asked for a URL. That field worked and was
 * exactly the wrong thing to leave in place: the two addresses somebody would
 * paste into it are one from a site that will reorganise itself, and one from
 * the library, which they would have to go and copy first.
 */
export function MediaPickerField({
  label,
  hint,
  value,
  onChange,
  folder = 'broadcast',
}: MediaPickerFieldProps) {
  const { c } = useTheme()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { rows } = await listMedia()
      setItems(rows.filter((item) => item.kind === 'image'))
    } catch {
      toast('Could not open the library', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const browse = () => {
    setOpen(true)
    load()
  }

  const upload = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: true,
    })
    if (picked.canceled || !picked.assets[0]?.base64) return

    const asset = picked.assets[0]
    setBusy(true)
    try {
      const item = await uploadMedia({
        base64: asset.base64!,
        mime: asset.mimeType ?? 'image/jpeg',
        title: asset.fileName ?? 'Broadcast picture',
        folder,
        width: asset.width,
        height: asset.height,
      })
      onChange(item.url)
      setOpen(false)
      toast('Added to the library')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not upload', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>

      {value ? (
        <View style={styles.chosen}>
          <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
          <View style={styles.chosenActions}>
            <Button label="Change" variant="secondary" size="sm" onPress={browse} />
            <Button
              label="Remove"
              variant="secondary"
              size="sm"
              onPress={() => onChange(null)}
            />
          </View>
        </View>
      ) : (
        <PressableScale
          onPress={browse}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[styles.empty, { backgroundColor: c.bgSurface }]}
        >
          <Ionicons name="image-outline" size={20} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>Choose a picture</Text>
        </PressableScale>
      )}

      {hint ? <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text> : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pictures">
        <View style={styles.sheet}>
          <Button
            label={busy ? 'Adding' : 'Upload a new one'}
            icon="cloud-upload-outline"
            onPress={upload}
            disabled={busy}
            fullWidth
          />

          {loading ? null : items.length === 0 ? (
            <EmptyState
              icon="images-outline"
              title="Nothing in the library"
              message="Upload one and it can be reused anywhere else too."
            />
          ) : (
            <ScrollView style={styles.grid} contentContainerStyle={styles.gridContent}>
              {items.map((item) => (
                <PressableScale
                  key={item.id}
                  onPress={() => {
                    onChange(item.url)
                    setOpen(false)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  style={styles.tile}
                >
                  <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
                  <Text style={[styles.tileTitle, { color: c.textSecondary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}
        </View>
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: Spacing.xs },
  label: { ...Typography.caption, fontFamily: FontFamily.medium },
  chosen: { gap: Spacing.xs },
  preview: { width: '100%', height: 132, borderRadius: Radius.md },
  chosenActions: { flexDirection: 'row', gap: Spacing.xs },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
  },
  emptyText: { ...Typography.body, fontFamily: FontFamily.regular },
  hint: { ...Typography.label, fontFamily: FontFamily.regular, lineHeight: 16 },
  sheet: { gap: Spacing.md, paddingBottom: Spacing.md },
  grid: { maxHeight: 320 },
  gridContent: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { width: 132, gap: 2 },
  thumb: { width: 132, height: 88, borderRadius: Radius.sm },
  tileTitle: { ...Typography.label, fontFamily: FontFamily.regular },
})
