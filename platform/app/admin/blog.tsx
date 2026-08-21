import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { deletePost, deploySite, listPosts, type BlogPost } from '@/lib/admin'
import { formatDateLong } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import {
  Button,
  EmptyState,
  ListRow,
  OverflowMenu,
  useConfirm,
  useToast,
} from '@/components/ui'

/**
 * The blog, which now lives in the database rather than in the website's code.
 *
 * Publishing asks Vercel to rebuild, so a post takes a minute or two to
 * appear. That is deliberate: these posts exist to be found in search, and a
 * page whose article arrives by fetch after the HTML is a page a crawler reads
 * as empty.
 */
export default function AdminBlog() {
  const { c } = useTheme()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [posts, setPosts] = useState<BlogPost[]>([])
  const [deployReady, setDeployReady] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { rows, deployConfigured } = await listPosts()
      setPosts(rows)
      setDeployReady(deployConfigured)
    } catch {
      toast('Could not load the posts', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const remove = async (post: BlogPost) => {
    const ok = await confirm({
      title: `Delete "${post.title}"?`,
      message: post.published
        ? 'It is live on the website. Anybody who has linked to it will get a missing page.'
        : 'It has never been published, so nothing links to it.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return

    try {
      await deletePost(post.id)
      toast('Deleted')
      load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not work', { tone: 'error' })
    }
  }

  const rebuild = async () => {
    try {
      await deploySite()
      toast('The website is rebuilding. Give it a minute or two.')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not work', { tone: 'error' })
    }
  }

  const live = posts.filter((post) => post.published).length

  return (
    <AdminScreen
      title="Writing"
      hint={`${live} live, ${posts.length - live} in draft. Publishing rebuilds the website, which takes a minute or two.`}
      loading={loading}
      actions={
        <>
          <Button
            label="Write one"
            icon="add"
            size="sm"
            onPress={() => router.push('/admin/post/new' as never)}
          />
          <OverflowMenu
            subject="Writing"
            actions={[
              {
                label: 'Rebuild the website now',
                icon: 'refresh-outline',
                onPress: rebuild,
                disabledReason: deployReady ? undefined : 'No deploy hook is set up yet',
              },
            ]}
          />
        </>
      }
    >
      {!deployReady ? (
        <View style={[styles.notice, { backgroundColor: c.warningLight }]}>
          <Text style={[styles.noticeText, { color: c.warning }]}>
            Posts save here, but the website cannot be asked to rebuild yet, so nothing new will
            appear on it. It needs a Vercel deploy hook, which is a one time setup.
          </Text>
        </View>
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          icon="create-outline"
          title="Nothing written yet"
          message="Write a post here, or bring one across from a Word document."
          actionLabel="Write one"
          onAction={() => router.push('/admin/post/new' as never)}
        />
      ) : (
        <View style={styles.rows}>
          {posts.map((post, index) => (
            <ListRow
              key={post.id}
              title={post.title}
              subtitle={`/blog/${post.slug}`}
              meta={`${formatDateLong(post.date)} · ${post.read_minutes} min`}
              trailing={
                <View style={styles.trailing}>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: post.published ? c.successLight : c.bgSurface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: post.published ? c.success : c.textMuted },
                      ]}
                    >
                      {post.published ? 'Live' : 'Draft'}
                    </Text>
                  </View>
                  <OverflowMenu
                    subject={post.title}
                    actions={[
                      {
                        label: 'Edit',
                        icon: 'create-outline',
                        onPress: () => router.push(`/admin/post/${post.id}` as never),
                      },
                      {
                        label: 'Delete',
                        icon: 'trash-outline',
                        onPress: () => remove(post),
                        destructive: true,
                      },
                    ]}
                  />
                </View>
              }
              index={index}
            />
          ))}
        </View>
      )}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.sm },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  pillText: { ...Typography.label, fontFamily: FontFamily.semiBold },
  notice: { borderRadius: Radius.md, padding: Spacing.md },
  noticeText: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 19 },
})
