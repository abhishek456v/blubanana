import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import {
  DESTINATION_NAMES,
  importDocx,
  listPosts,
  savePost,
  type BlogPost,
} from '@/lib/admin'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { MediaPickerField } from '@/components/admin/MediaPickerField'
import { Button, Card, Chip, DateField, TextField, useConfirm, useToast } from '@/components/ui'

type Draft = Partial<BlogPost>

const EMPTY: Draft = {
  slug: '',
  title: '',
  date: new Date().toISOString().slice(0, 10),
  read_minutes: 5,
  description: '',
  lede: '',
  body_html: '',
  tool_href: '/tools',
  tool_label: 'Try the calculators',
  published: false,
}

/**
 * Writing one post.
 *
 * The body is HTML in a text box rather than a rich editor. That is a
 * deliberate stopping point: a real editor is weeks of work and the usual way
 * in is a Word document, which the import below handles properly. Somebody
 * writing directly here is making a small change to something that already
 * exists.
 */
export default function PostEditor() {
  const { c } = useTheme()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = !id || id === 'new'

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [destinations, setDestinations] = useState<string[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  // Fetched even for a new post, because the list of places a post may link to
  // comes from the server and the editor must only offer what will be accepted.
  useEffect(() => {
    listPosts()
      .then(({ rows, destinations: allowed }) => {
        setDestinations(allowed ?? [])
        if (isNew) return
        const found = rows.find((row) => row.id === id)
        if (found) setDraft(found)
      })
      .catch(() => toast('Could not open that post', { tone: 'error' }))
      .finally(() => setLoading(false))
  }, [id, isNew, toast])

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    []
  )

  /**
   * Bring a Word document in.
   *
   * The file goes to the server as base64 and comes back as clean HTML with
   * its pictures already uploaded to the media library and their links
   * rewritten. Nothing about the document reaches the website; only what the
   * converter produced.
   */
  const bringIn = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      copyToCacheDirectory: true,
    })
    if (picked.canceled || !picked.assets[0]) return

    setImporting(true)
    try {
      const base64 = await readAsBase64(picked.assets[0])
      const result = await importDocx(base64)

      setDraft((current) => ({
        ...current,
        title: result.title || current.title,
        body_html: result.body_html,
        read_minutes: result.read_minutes,
        slug: current.slug || slugify(result.title),
      }))

      if (result.warnings.length > 0) toast(result.warnings[0], { tone: 'error' })
      else
        toast(
          result.images > 0
            ? `Brought in, with ${result.images} ${result.images === 1 ? 'picture' : 'pictures'}`
            : 'Brought in'
        )
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That document did not come through', {
        tone: 'error',
      })
    } finally {
      setImporting(false)
    }
  }

  const save = async (publish: boolean) => {
    if (publish && !draft.published) {
      const ok = await confirm({
        title: 'Publish this?',
        message:
          'It goes on the website and the site rebuilds, which takes a minute or two. Anybody can read it after that.',
        confirmLabel: 'Publish',
      })
      if (!ok) return
    }

    setSaving(true)
    try {
      const { deployed } = await savePost({
        ...draft,
        slug: draft.slug || slugify(draft.title ?? ''),
        published: publish || Boolean(draft.published),
      })
      toast(
        publish && deployed
          ? 'Published. The website is rebuilding.'
          : publish
            ? 'Published, but the website cannot rebuild yet.'
            : 'Saved'
      )
      router.push('/admin/blog' as never)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not save', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const descriptionShort = (draft.description ?? '').length < 60

  return (
    <AdminScreen
      title={isNew ? 'A new post' : (draft.title ?? 'Post')}
      hint={
        isNew
          ? 'Write it here, or bring a Word document across.'
          : `Lives at /blog/${draft.slug ?? ''}`
      }
      loading={loading}
      actions={
        <>
          <Button
            label={importing ? 'Reading' : 'From a Word file'}
            icon="document-text-outline"
            variant="secondary"
            size="sm"
            onPress={bringIn}
            disabled={importing}
          />
          <Button
            label={saving ? 'Saving' : 'Save'}
            size="sm"
            onPress={() => save(false)}
            disabled={saving}
          />
        </>
      }
    >
      <Card>
        <View style={styles.form}>
        <TextField
          label="Title"
          placeholder="When a brand does not pay"
          value={draft.title ?? ''}
          onChangeText={(value) =>
            setDraft((current) => ({
              ...current,
              title: value,
              // The address follows the title until somebody has published,
              // after which changing it would break every link ever shared.
              slug: current.published ? current.slug : slugify(value),
            }))
          }
          hint={`${(draft.title ?? '').length} of 64 characters`}
        />
        <TextField
          label="Address"
          placeholder="when-a-brand-does-not-pay"
          value={draft.slug ?? ''}
          onChangeText={(value) => set('slug', slugify(value))}
          autoCapitalize="none"
          hint={
            draft.published
              ? 'Changing this breaks every link anybody has shared to it.'
              : `blubanana.in/blog/${draft.slug ?? ''}`
          }
        />
        <TextField
          label="Description"
          placeholder="What somebody sees under the title in a search result."
          value={draft.description ?? ''}
          onChangeText={(value) => set('description', value)}
          multiline
          hint={
            descriptionShort
              ? `${(draft.description ?? '').length} of at least 60 characters. Search engines show this.`
              : `${(draft.description ?? '').length} characters`
          }
        />
        <TextField
          label="Opening line"
          placeholder="Most creators find out what their contract says at the worst possible moment."
          value={draft.lede ?? ''}
          onChangeText={(value) => set('lede', value)}
          multiline
        />
        </View>
      </Card>

      <Card>
        <Text style={[styles.label, { color: c.textSecondary }]}>The post</Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Plain HTML. Headings are h2, paragraphs are p. A Word file brought in above fills this
          in for you.
        </Text>
        <TextField
          label=""
          value={draft.body_html ?? ''}
          onChangeText={(value) => set('body_html', value)}
          multiline
          inputStyle={styles.body}
        />
      </Card>

      <Card>
        <View style={styles.form}>
        <View style={styles.pair}>
          <View style={styles.half}>
            <DateField
              label="Date on the post"
              value={draft.date ?? ''}
              onChange={(value) => set('date', value ?? new Date().toISOString().slice(0, 10))}
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="Reading time, in minutes"
              value={String(draft.read_minutes ?? 5)}
              onChangeText={(value) => set('read_minutes', Number(value.replace(/\D/g, '')) || 1)}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* A list, not a box to type a path into.
            A typo here would not break one link: the website's build refuses a
            link to a page that does not exist, and it refuses all or nothing,
            so one wrong character would stop the entire site deploying. */}
        <Text style={[styles.label, { color: c.textSecondary }]}>Where the post ends</Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Every post ends at the tool that does the arithmetic it describes.
        </Text>
        <View style={styles.destinations}>
          {destinations.map((path) => (
            <Chip
              key={path}
              label={DESTINATION_NAMES[path] ?? path}
              selected={draft.tool_href === path}
              onPress={() => set('tool_href', path)}
              size="sm"
            />
          ))}
        </View>
        <TextField
          label="What that link says"
          placeholder="Work out your four dates"
          value={draft.tool_label ?? ''}
          onChangeText={(value) => set('tool_label', value)}
        />

        <MediaPickerField
          label="Cover picture (optional)"
          value={draft.cover_url ?? null}
          onChange={(url) => set('cover_url', url)}
          folder="blog"
        />
        </View>
      </Card>

      <Button
        label={draft.published ? 'Save and rebuild the website' : 'Publish'}
        onPress={() => save(true)}
        disabled={saving}
        fullWidth
      />
      <Text style={[styles.footnote, { color: c.textMuted }]}>
        Nothing appears on the website until it is published, and the site takes a minute or two
        to rebuild after that.
      </Text>
    </AdminScreen>
  )
}

/**
 * The picked file as base64, on a phone and in a browser.
 *
 * The two runtimes hand back different things and neither can read the other's:
 * on the web the asset carries a real `File`, and its `uri` is a blob URL that
 * the file system module knows nothing about. On a phone there is no `File` and
 * the uri is a path. Asking the wrong one is a silent failure at exactly the
 * moment somebody is importing a document they spent an afternoon writing.
 */
async function readAsBase64(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  const file = (asset as { file?: File }).file
  if (file) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('That file could not be read'))
      // A data URL, whose payload after the comma is the base64. The server
      // strips the prefix, so either form is accepted.
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(file)
    })
  }

  return await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
}

/** The address form of a title: lower case, words joined by hyphens. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const styles = StyleSheet.create({
  label: { ...Typography.caption, fontFamily: FontFamily.medium },
  hint: { ...Typography.label, fontFamily: FontFamily.regular, lineHeight: 16, marginBottom: Spacing.xs },
  form: { gap: Spacing.md },
  body: { minHeight: 280 },
  destinations: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pair: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  half: { flexGrow: 1, flexBasis: 180 },
  footnote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    textAlign: 'center',
  },
})
