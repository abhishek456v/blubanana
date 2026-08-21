import { useCallback, useMemo, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { getAdminPeople, type AdminPerson } from '@/lib/admin'
import { formatRelativeDay } from '@/lib/format'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AdminScreen } from '@/components/admin/AdminScreen'
import {
  Chip,
  DataTable,
  EmptyState,
  ListRow,
  PressableScale,
  TextField,
  useToast,
} from '@/components/ui'

type Filter = 'all' | 'trialing' | 'active' | 'quiet'

/**
 * Everybody using the product, one row each.
 *
 * The column that earns its place is "deals". A workspace with a subscription
 * and no deals is somebody who signed up and never started, which is the only
 * thing on this screen that can be acted on the same day.
 */
export default function AdminPeople() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [people, setPeople] = useState<AdminPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    try {
      setPeople(await getAdminPeople())
    } catch {
      toast('Could not load the list', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people.filter((p) => {
      if (filter === 'quiet' && p.deals > 0) return false
      if (filter === 'trialing' && p.status !== 'trialing') return false
      if (filter === 'active' && p.status !== 'active') return false
      if (!needle) return true
      return [p.name, p.email, p.phone, p.workspace_name, p.niche]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    })
  }, [people, query, filter])

  /** An empty string in `profiles.name` is a missing name, not a name. */
  const displayName = (person: AdminPerson) =>
    (person.name ?? '').trim() || person.workspace_name

  const open = (person: AdminPerson) =>
    router.push(`/admin/workspace/${person.workspace_id}` as never)

  const message = (person: AdminPerson) => {
    if (!person.phone) {
      toast('No phone number on this account', { tone: 'error' })
      return
    }
    const link = buildWhatsAppLink(person.phone, `Hi ${person.name ?? 'there'}, `)
    if (link) Linking.openURL(link).catch(() => toast('Could not open WhatsApp', { tone: 'error' }))
  }

  const email = (person: AdminPerson) => {
    if (!person.email) {
      toast('No email on this account', { tone: 'error' })
      return
    }
    Linking.openURL(`mailto:${person.email}`).catch(() => {})
  }

  const quiet = people.filter((p) => p.deals === 0).length

  return (
    <AdminScreen
      title="People"
      hint={`${people.length} ${people.length === 1 ? 'account' : 'accounts'}. ${quiet} of them have never added a deal.`}
      loading={loading}
    >
      <TextField
        label="Search"
        placeholder="A name, an email, a phone number"
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.filters}>
        {(
          [
            ['all', 'Everyone'],
            ['trialing', 'On trial'],
            ['active', 'Paying'],
            ['quiet', 'Never started'],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={filter === key}
            onPress={() => setFilter(key)}
            size="sm"
          />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Nobody here"
          message="No account matches what you are looking for."
        />
      ) : isDesktop ? (
        <DataTable
          columns={[
            {
              key: 'name',
              title: 'Name',
              flex: 2,
              // The name is the way in, rather than the whole row.
              //
              // A pressable row would be nicer to click and would put a
              // <button> around the two contact buttons in the last column,
              // which is invalid HTML and produces a hydration error in the
              // browser. Controls inside a row and a press on the row itself
              // cannot both exist; the row gives way.
              render: (p: AdminPerson) => (
                <PressableScale
                  onPress={() => open(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${displayName(p)}`}
                >
                  <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
                    {displayName(p)}
                  </Text>
                </PressableScale>
              ),
            },
            { key: 'email', title: 'Email', flex: 2.4, render: (p: AdminPerson) => p.email ?? '' },
            {
              key: 'status',
              title: 'Status',
              flex: 1,
              render: (p: AdminPerson) => <StatusPill status={p.status} />,
            },
            {
              key: 'deals',
              title: 'Deals',
              flex: 0.7,
              align: 'right',
              render: (p: AdminPerson) => String(p.deals),
            },
            {
              key: 'joined',
              title: 'Joined',
              flex: 1,
              align: 'right',
              render: (p: AdminPerson) => formatRelativeDay(p.created_at),
            },
            {
              key: 'reach',
              title: '',
              flex: 0.8,
              align: 'right',
              render: (p: AdminPerson) => (
                <View style={styles.reach}>
                  <PressableScale
                    onPress={() => message(p)}
                    hitSlop={HitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${p.name ?? 'this person'} on WhatsApp`}
                  >
                    <Ionicons name="logo-whatsapp" size={17} color={c.textSecondary} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => email(p)}
                    hitSlop={HitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Email ${p.name ?? 'this person'}`}
                  >
                    <Ionicons name="mail-outline" size={17} color={c.textSecondary} />
                  </PressableScale>
                </View>
              ),
            },
          ]}
          rows={shown}
          keyOf={(p) => p.workspace_id}
        />
      ) : (
        <View style={styles.rows}>
          {shown.map((p, index) => (
            <ListRow
              key={p.workspace_id}
              title={displayName(p)}
              subtitle={p.email ?? undefined}
              meta={`${p.deals} ${p.deals === 1 ? 'deal' : 'deals'} · joined ${formatRelativeDay(p.created_at)}`}
              trailing={<StatusPill status={p.status} />}
              onPress={() => open(p)}
              showChevron
              index={index}
            />
          ))}
        </View>
      )}
    </AdminScreen>
  )
}

function StatusPill({ status }: { status: string | null }) {
  const { c } = useTheme()
  const tone =
    status === 'active'
      ? { bg: c.successLight, fg: c.success, label: 'Paying' }
      : status === 'trialing'
        ? { bg: c.accentLight, fg: c.accentText, label: 'Trial' }
        : status === 'past_due'
          ? { bg: c.dangerLight, fg: c.danger, label: 'Late' }
          : { bg: c.bgSurfaceRaised, fg: c.textSecondary, label: status ?? 'None' }

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  rows: { gap: Spacing.sm },
  reach: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  name: { ...Typography.body, fontFamily: FontFamily.medium },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  pillText: { ...Typography.label, fontFamily: FontFamily.semiBold },
})
