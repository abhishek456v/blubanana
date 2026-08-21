import { useCallback, useState } from 'react'
import { Image, Platform, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import {
  deleteMedia,
  formatBytes,
  listMedia,
  sweepMedia,
  updateMedia,
  uploadMedia,
  type MediaFolder,
  type MediaItem,
} from '@/lib/admin'
import { formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import {
  Button,
  Chip,
  EmptyState,
  OverflowMenu,
  PressableScale,
  Sheet,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'

const FOLDERS: MediaFolder[] = ['general', 'website', 'blog', 'app', 'broadcast']

/**
 * Every picture and video the product shows, in one place.
 *
 * Until this existed an image was either committed into the website
 * repository, which needs a deploy to change, or pasted in as somebody else's
 * URL, which breaks the day they reorganise their site. Neither is something
 * to put a launch banner on.
 */
export default function AdminMedia() {
  const { c } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [folder, setFolder] = useState<'all' | MediaFolder>('all')
  const [editing, setEditing] = useState<MediaItem | null>(null)
  const [showing, setShowing] = useState<MediaItem | null>(null)
  const [title, setTitle] = useState('')
  const [alt, setAlt] = useState('')

  const load = useCallback(async () => {
    try {
      const { rows } = await listMedia(folder === 'all' ? undefined : folder)
      setItems(rows)
    } catch {
      toast('Could not load the library', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [folder, toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  /**
   * Pick a file and put it in.
   *
   * base64 rather than a URI, because a `file://` URI cannot be read into
   * bytes on every platform this runs on, and that is exactly where uploads
   * usually break.
   */
  const add = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.9,
      base64: true,
    })
    if (picked.canceled || !picked.assets[0]?.base64) return

    const asset = picked.assets[0]
    setBusy(true)
    try {
      await uploadMedia({
        base64: asset.base64!,
        mime: asset.mimeType ?? 'image/jpeg',
        // Named after where it is going, so the library is readable before
        // anybody has bothered to rename anything.
        title: asset.fileName ?? `${folder === 'all' ? 'general' : folder} picture`,
        folder: folder === 'all' ? 'general' : folder,
        width: asset.width,
        height: asset.height,
      })
      toast('Added')
      load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not upload', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /**
   * Copy the address, or show it to be copied by hand.
   *
   * No clipboard library. Adding one means a native module, which means every
   * installed copy of the app needs replacing to gain a convenience on a
   * screen that is used on a desktop browser. The browser has a clipboard
   * already; the phone gets selectable text, which works everywhere and costs
   * nothing.
   */
  const copy = async (item: MediaItem) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(item.url).catch(() => {})
      toast('Address copied')
      return
    }
    setShowing(item)
  }

  const remove = async (item: MediaItem, force = false) => {
    try {
      await deleteMedia(item.id, force)
      toast('Deleted')
      load()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That did not work'
      if (/still used by/i.test(message)) {
        const ok = await confirm({
          title: message,
          message:
            'Deleting it will leave a broken picture wherever it is used. Delete it anyway?',
          confirmLabel: 'Delete anyway',
          destructive: true,
        })
        if (ok) remove(item, true)
        return
      }
      toast(message, { tone: 'error' })
    }
  }

  const tidy = async () => {
    try {
      const { orphans } = await sweepMedia(false)
      if (orphans.length === 0) {
        toast('Nothing to tidy up')
        return
      }
      const ok = await confirm({
        title: `${orphans.length} ${orphans.length === 1 ? 'file is' : 'files are'} not in the library`,
        message:
          'These were uploaded but never recorded, so nothing can show them. Delete them for good?',
        confirmLabel: 'Delete them',
        destructive: true,
      })
      if (!ok) return
      await sweepMedia(true)
      toast('Tidied up')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not work', { tone: 'error' })
    }
  }

  const saveDetails = async () => {
    if (!editing) return
    try {
      await updateMedia(editing.id, { title: title.trim(), alt: alt.trim() })
      setEditing(null)
      toast('Saved')
      load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not save', { tone: 'error' })
    }
  }

  return (
    <AdminScreen
      title="Media"
      hint="Pictures and video for the website, the app and anything you broadcast."
      loading={loading}
      actions={
        <>
          <Button
            label={busy ? 'Adding' : 'Add a file'}
            icon="add"
            onPress={add}
            disabled={busy}
            size="sm"
          />
          <OverflowMenu
            subject="Media"
            actions={[
              {
                label: 'Tidy up stray files',
                icon: 'trash-bin-outline',
                onPress: tidy,
                destructive: true,
              },
            ]}
          />
        </>
      }
    >
      <View style={styles.filters}>
        <Chip
          label="Everything"
          selected={folder === 'all'}
          onPress={() => setFolder('all')}
          size="sm"
        />
        {FOLDERS.map((name) => (
          <Chip
            key={name}
            label={name}
            selected={folder === name}
            onPress={() => setFolder(name)}
            size="sm"
          />
        ))}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title="Nothing in here yet"
          message="Add a picture and it can be used on the website, in a broadcast, or at the top of the app."
          actionLabel="Add a file"
          onAction={add}
        />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <View key={item.id} style={[styles.tile, { backgroundColor: c.bgSurface }]}>
              <PressableScale
                onPress={() => copy(item)}
                accessibilityRole="button"
                accessibilityLabel={`Copy the address of ${item.title}`}
                style={styles.thumbWrap}
              >
                {item.kind === 'image' ? (
                  <Image
                    source={{ uri: item.url }}
                    style={styles.thumb}
                    resizeMode="cover"
                    accessible={false}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: c.bgPage }]}>
                    <Ionicons
                      name={item.kind === 'video' ? 'videocam-outline' : 'document-outline'}
                      size={26}
                      color={c.textMuted}
                    />
                  </View>
                )}
              </PressableScale>

              <View style={styles.tileText}>
                <Text style={[styles.tileTitle, { color: c.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.tileMeta, { color: c.textMuted }]} numberOfLines={1}>
                  {formatBytes(item.bytes)} · {formatRelativeDay(item.created_at)}
                </Text>
                {item.kind === 'image' && !item.alt ? (
                  <Text style={[styles.tileMeta, { color: c.warning }]} numberOfLines={1}>
                    No description
                  </Text>
                ) : null}
              </View>

              <View style={styles.tileMenu}>
                <OverflowMenu
                  subject={item.title}
                  actions={[
                    { label: 'Copy the address', icon: 'link-outline', onPress: () => copy(item) },
                    {
                      label: 'Rename and describe',
                      icon: 'create-outline',
                      onPress: () => {
                        setEditing(item)
                        setTitle(item.title)
                        setAlt(item.alt ?? '')
                      },
                    },
                    {
                      label: 'Delete',
                      icon: 'trash-outline',
                      onPress: () => remove(item),
                      destructive: true,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <Sheet
        visible={showing !== null}
        onClose={() => setShowing(null)}
        title={showing?.title ?? 'File'}
      >
        <View style={styles.sheet}>
          <Text style={[styles.tileMeta, { color: c.textSecondary }]}>
            Press and hold to copy this address.
          </Text>
          <Text selectable style={[styles.address, { color: c.textPrimary }]}>
            {showing?.url}
          </Text>
        </View>
      </Sheet>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.title ?? 'File'}
      >
        <View style={styles.sheet}>
          <TextField label="Name" value={title} onChangeText={setTitle} />
          <TextField
            label="What it shows"
            placeholder="A creator at a desk, looking at her phone"
            hint="Read aloud to anybody who cannot see the picture. Worth a sentence."
            value={alt}
            onChangeText={setAlt}
            multiline
          />
          <Button label="Save" onPress={saveDetails} fullWidth />
        </View>
      </Sheet>
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 210,
    maxWidth: 320,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  thumbWrap: { borderRadius: Radius.sm, overflow: 'hidden' },
  thumb: { width: '100%', height: 116 },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  tileText: { gap: 1 },
  tileTitle: { ...Typography.caption, fontFamily: FontFamily.semiBold },
  tileMeta: { ...Typography.label, fontFamily: FontFamily.regular },
  tileMenu: { position: 'absolute', top: Spacing.sm + 2, right: Spacing.sm + 2 },
  sheet: { gap: Spacing.md, paddingBottom: Spacing.md },
  address: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 20 },
})
