import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import {
  getAdminActivity,
  getAdminAudit,
  type ActivityEntry,
  type AdminAuditEntry,
} from '@/lib/admin'
import { formatDateLong } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Chip, EmptyState, ListRow, SegmentedControl, useToast } from '@/components/ui'

/**
 * What has been happening, from the log that was filling up all along.
 *
 * `audit_logs` had hundreds of rows in it before anything could read them.
 * This is a screen over data that already existed, which is the cheapest kind
 * of feature there is.
 */
export default function AdminActivity() {
  const { c } = useTheme()
  const toast = useToast()

  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [actors, setActors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<string>('all')

  /*
   * Two logs, deliberately not merged.
   *
   * `audit_logs` is what creators did inside their own workspaces.
   * `admin_audit_logs` is what this dashboard did, including what it read.
   * They answer different questions and mixing them would make both
   * unanswerable.
   *
   * The second one had been filling up since the first admin screen shipped
   * and nothing could read it. A record nobody can produce is not a record.
   */
  const [which, setWhich] = useState<'creators' | 'dashboard'>('creators')
  const [audit, setAudit] = useState<AdminAuditEntry[]>([])
  const [actorEmails, setActorEmails] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      if (which === 'creators') {
        const data = await getAdminActivity()
        setEntries(data.rows)
        setNames(data.workspaceNames)
        setActors(data.actorNames)
      } else {
        const data = await getAdminAudit()
        setAudit(data.rows)
        setActorEmails(data.actorEmails)
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load the activity', {
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, which])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const kinds = useMemo(
    () => ['all', ...new Set(entries.map((entry) => entry.entity_type))],
    [entries]
  )

  const shown = entries.filter((entry) => kind === 'all' || entry.entity_type === kind)

  return (
    <AdminScreen
      title="Activity"
      hint="The last 200 things anybody did, across every workspace."
      loading={loading}
    >
      <SegmentedControl
        options={[
          { key: 'creators', label: 'What creators did' },
          { key: 'dashboard', label: 'What this dashboard did' },
        ]}
        value={which}
        onChange={(value) => {
          setWhich(value)
          setLoading(true)
        }}
      />

      {which === 'dashboard' ? (
        audit.length === 0 ? (
          <EmptyState
            icon="shield-outline"
            title="Nothing recorded yet"
            message="Every admin screen writes here, including the ones that only read."
          />
        ) : (
          <View style={styles.rows}>
            {audit.map((entry, index) => (
              <ListRow
                key={entry.id}
                title={adminSentence(entry)}
                subtitle={`${actorEmails[entry.actor_id] ?? 'Somebody'} · ${entry.role}`}
                meta={formatDateLong(entry.created_at)}
                index={index}
              />
            ))}
          </View>
        )
      ) : (
        <>
      <View style={styles.filters}>
        {kinds.map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? 'Everything' : value}
            selected={kind === value}
            onPress={() => setKind(value)}
            size="sm"
          />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon="pulse-outline"
          title="Nothing recorded"
          message="No activity of that kind yet."
        />
      ) : (
        <View style={styles.rows}>
          {shown.map((entry, index) => (
            <ListRow
              key={entry.id}
              title={sentence(entry)}
              subtitle={names[entry.workspace_id] ?? 'Unknown workspace'}
              meta={metaFor(entry, names, actors)}
              index={index}
            />
          ))}
        </View>
      )}
        </>
      )}
    </AdminScreen>
  )
}

/**
 * An admin action, said as a sentence.
 *
 * The stored value is the action name the function routes on, which is right
 * for a router and useless in a list: nobody scanning for who looked at a
 * creator's money is helped by "people.snapshot".
 */
function adminSentence(entry: AdminAuditEntry): string {
  const words: Record<string, string> = {
    overview: 'Opened the dashboard',
    health: 'Checked what is broken',
    funnel: 'Looked at who is getting started',
    people: 'Listed everybody',
    'people.snapshot': 'Looked inside one workspace',
    activity: 'Read the activity log',
    'admin.audit': 'Read this log',
    subscriptions: 'Listed subscriptions',
    'subscriptions.adjust': 'Changed somebody\'s subscription',
    'pricing.get': 'Opened the price list',
    'pricing.save': 'Changed the price',
    'announcements.list': 'Opened broadcast',
    'announcements.save': 'Saved a broadcast',
    'announcements.delete': 'Deleted a broadcast',
    'media.list': 'Opened the media library',
    'media.uploadUrl': 'Started an upload',
    'media.register': 'Added a file',
    'media.update': 'Renamed a file',
    'media.delete': 'Deleted a file',
    'media.sweep': 'Tidied up stray files',
    'support.list': 'Opened help',
    'support.get': 'Read a ticket',
    'support.reply': 'Replied on a ticket',
    'support.update': 'Changed a ticket',
    'flags.list': 'Looked at the switches',
    'flags.set': 'Threw a switch',
    'data.list': 'Opened the data requests',
    'data.update': 'Progressed a data request',
    'blog.list': 'Opened the blog',
    'blog.save': 'Saved a post',
    'blog.delete': 'Deleted a post',
    'blog.import': 'Brought in a Word document',
    'site.deploy': 'Asked the website to rebuild',
    'content.list': 'Opened the words',
    'content.save': 'Changed some words',
  }
  return words[entry.action] ?? entry.action
}

/** "Added a deal" rather than "deal / create". A log nobody can read is a file. */
function sentence(entry: ActivityEntry): string {
  const verb =
    entry.action === 'create'
      ? 'Added'
      : entry.action === 'update'
        ? 'Changed'
        : entry.action === 'delete'
          ? 'Deleted'
          : entry.action
  // "a invoice" is the sort of thing that makes a screen look unfinished.
  const article = /^[aeiou]/i.test(entry.entity_type) ? 'an' : 'a'
  return `${verb} ${article} ${entry.entity_type}`
}

/**
 * Who did it and when, without saying either thing twice.
 *
 * A creator working alone is the only member of a workspace named after her,
 * so the actor and the workspace are the same word and printing both read as a
 * stutter. And when the actor was not recorded, that is what it says: the
 * previous wording claimed "The system", which is a guess, and a log that
 * guesses is worse than one that admits a gap.
 */
function metaFor(
  entry: ActivityEntry,
  names: Record<string, string>,
  actors: Record<string, string>
): string {
  const when = formatDateLong(entry.created_at)
  if (!entry.actor_user_id) return `Who is not recorded · ${when}`

  const actor = actors[entry.actor_user_id]
  if (!actor) return `Somebody · ${when}`
  if (actor === names[entry.workspace_id]) return when
  return `${actor} · ${when}`
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  rows: { gap: Spacing.sm },
})
