import { useCallback, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import {
  DEFAULT_PERMISSIONS,
  FULL_PERMISSIONS,
  PERMISSION_AREAS,
  getMyAccess,
  getPendingInvites,
  getTeam,
  inviteManager,
  removeMember,
  revokeInvite,
  updateMemberAccess,
  type PendingInvite,
  type Permissions,
  type TeamMember,
} from '@/lib/team'
import { ContentMaxWidth, FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  Chip,
  EmptyState,
  PressableScale,
  RevealScrollView,
  Skeleton,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui'

/** Rough shape of a valid address. The database and the invitee's inbox are the real checks. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function countGranted(permissions: Permissions): number {
  return PERMISSION_AREAS.filter((a) => permissions[a.key]).length
}

/** "Full access", "No access", or the areas themselves — short enough to read at a glance. */
function describeAccess(permissions: Permissions): string {
  const granted = PERMISSION_AREAS.filter((a) => permissions[a.key])
  if (granted.length === 0) return 'No access'
  if (granted.length === PERMISSION_AREAS.length) return 'Full access'
  return granted.map((a) => a.label).join(', ')
}

function pickPermissions(source: Permissions): Permissions {
  return Object.fromEntries(
    PERMISSION_AREAS.map((a) => [a.key, source[a.key] ?? false])
  ) as Permissions
}

/**
 * The per-area switches, used by both the invite form and the edit-access panel.
 *
 * Deliberately a plain list rather than a preset dropdown. §7 describes the
 * grant as a per-area decision, and the two presets below are shortcuts into
 * these switches rather than a replacement for them — the creator can always
 * see exactly what she is handing over.
 */
function PermissionSwitches({
  value,
  onChange,
  disabled,
}: {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}) {
  const { c } = useTheme()

  return (
    <View style={styles.switches}>
      {PERMISSION_AREAS.map((area) => (
        <View key={area.key} style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: c.textPrimary }]}>{area.label}</Text>
          <Switch
            value={value[area.key]}
            onValueChange={(next) => onChange({ ...value, [area.key]: next })}
            disabled={disabled}
            trackColor={{ false: c.border, true: c.accent }}
          />
        </View>
      ))}
    </View>
  )
}

/**
 * Who else can get in, and what they can see (PRODUCT.md §7).
 *
 * Only the creator reaches the controls here. That is enforced in the database
 * — the invite policy and the member-email lookup are both scoped to
 * workspaces the caller owns — so this screen showing the wrong thing would
 * fail closed rather than leak.
 *
 * What no switch on this screen can grant: deletion. Migration 024 makes that
 * a restrictive policy, so a manager cannot delete a deal, payment, invoice or
 * brand however much access is turned on.
 */
export default function TeamScreen() {
  const { c } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()

  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])

  const [inviting, setInviting] = useState(false)
  const [sending, setSending] = useState(false)
  const [email, setEmail] = useState('')
  const [draft, setDraft] = useState<Permissions>(DEFAULT_PERMISSIONS)

  // Which member's access panel is open, and the unsaved state of it.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Permissions>(DEFAULT_PERMISSIONS)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    try {
      const access = await getMyAccess()
      setIsOwner(access.isOwner)

      // A manager gets an empty list from both of these anyway; skipping the
      // calls avoids two round trips to render a screen they cannot use.
      if (access.isOwner) {
        const [team, pending] = await Promise.all([getTeam(), getPendingInvites()])
        setMembers(team)
        setInvites(pending)
      }
    } catch {
      toast('Could not load your team', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  function resetInvite() {
    setInviting(false)
    setEmail('')
    setDraft(DEFAULT_PERMISSIONS)
  }

  async function handleInvite() {
    const address = email.trim().toLowerCase()
    if (!EMAIL_RE.test(address)) {
      toast('Enter the email they sign in with', { tone: 'warning' })
      return
    }

    setSending(true)
    try {
      const invite = await inviteManager(address, draft)
      setInvites((prev) => [invite, ...prev])
      resetInvite()
      toast(`Invited ${address}`)
    } catch (error) {
      // inviteManager turns the unique-index violation into a sentence worth
      // showing; anything else is genuinely unexpected.
      toast(error instanceof Error ? error.message : 'Could not send that invite', {
        tone: 'error',
      })
    } finally {
      setSending(false)
    }
  }

  function startEditing(member: TeamMember) {
    setEditingId(member.id)
    setEditDraft(pickPermissions(member))
  }

  async function handleSaveAccess(member: TeamMember) {
    setSavingEdit(true)
    try {
      await updateMemberAccess(member.id, editDraft)
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, ...editDraft } : m))
      )
      setEditingId(null)
      toast('Access updated')
    } catch {
      toast('Could not update their access', { tone: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleRemove(member: TeamMember) {
    const ok = await confirm({
      title: 'Remove this person?',
      message: `${member.email ?? 'This manager'} loses access immediately. Everything they entered stays in your workspace.`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return

    try {
      await removeMember(member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch {
      toast('Could not remove them', { tone: 'error' })
    }
  }

  async function handleRevoke(invite: PendingInvite) {
    try {
      await revokeInvite(invite.id)
      setInvites((prev) => prev.filter((i) => i.id !== invite.id))
    } catch {
      toast('Could not withdraw that invite', { tone: 'error' })
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Team">
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>
            <Skeleton height={120} radius={Radius.lg} />
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  if (!isOwner) {
    return (
      <ModalSheet title="Team">
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>
            <EmptyState
              icon="lock-closed-outline"
              title="Only the creator manages the team"
              message="You have access to this workspace, but inviting people and changing what they can see belongs to whoever owns it."
            />
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="Team">
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: c.textMuted }]}>
            Invite a manager and choose, area by area, what they can see. Nobody but you
            can delete a deal, payment, invoice or brand — that holds even if you switch
            everything on.
          </Text>

          <View style={styles.list}>
            {members.map((member) => (
              <Animated.View
                key={member.id}
                entering={FadeIn.duration(Duration.fast)}
                exiting={FadeOut.duration(Duration.fast)}
                layout={Layout.duration(Duration.base)}
                style={[styles.card, { backgroundColor: c.bgSurface }]}
              >
                <View style={styles.cardHead}>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: c.textPrimary }]} numberOfLines={1}>
                      {member.email ?? 'Unknown account'}
                    </Text>
                    <Text style={[styles.cardMeta, { color: c.textMuted }]} numberOfLines={2}>
                      {member.role === 'owner'
                        ? 'Creator · everything, including deleting'
                        : describeAccess(pickPermissions(member))}
                    </Text>
                  </View>

                  {member.role === 'owner' ? (
                    <Chip label="You" />
                  ) : (
                    <PressableScale
                      onPress={() => handleRemove(member)}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${member.email ?? 'this manager'}`}
                    >
                      <Ionicons name="close" size={17} color={c.textMuted} />
                    </PressableScale>
                  )}
                </View>

                {member.role !== 'owner' ? (
                  editingId === member.id ? (
                    <Animated.View entering={FadeIn.duration(Duration.fast)} style={styles.panel}>
                      <PermissionSwitches
                        value={editDraft}
                        onChange={setEditDraft}
                        disabled={savingEdit}
                      />
                      <Button
                        label={savingEdit ? 'Saving…' : 'Save access'}
                        onPress={() => handleSaveAccess(member)}
                        disabled={savingEdit}
                        fullWidth
                      />
                      <Button
                        label="Cancel"
                        variant="ghost"
                        onPress={() => setEditingId(null)}
                        fullWidth
                      />
                    </Animated.View>
                  ) : (
                    <Button
                      label="Change access"
                      variant="ghost"
                      onPress={() => startEditing(member)}
                      fullWidth
                    />
                  )
                ) : null}
              </Animated.View>
            ))}

            {invites.map((invite) => (
              <Animated.View
                key={invite.id}
                entering={FadeIn.duration(Duration.fast)}
                exiting={FadeOut.duration(Duration.fast)}
                layout={Layout.duration(Duration.base)}
                style={[styles.card, { backgroundColor: c.bgSurface }]}
              >
                <View style={styles.cardHead}>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: c.textPrimary }]} numberOfLines={1}>
                      {invite.email}
                    </Text>
                    <Text style={[styles.cardMeta, { color: c.textMuted }]} numberOfLines={2}>
                      Invited · joins with {countGranted(pickPermissions(invite))} of{' '}
                      {PERMISSION_AREAS.length} areas
                    </Text>
                  </View>
                  <PressableScale
                    onPress={() => handleRevoke(invite)}
                    hitSlop={HitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Withdraw the invite to ${invite.email}`}
                  >
                    <Ionicons name="close" size={17} color={c.textMuted} />
                  </PressableScale>
                </View>
                <Text style={[styles.pendingHint, { color: c.textMuted }]}>
                  They get in by signing up with this address — there is no link to
                  forward.
                </Text>
              </Animated.View>
            ))}
          </View>

          {inviting ? (
            <Animated.View
              entering={FadeIn.duration(Duration.fast)}
              style={[styles.form, { backgroundColor: c.bgSurface }]}
            >
              <TextField
                label="Their email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="manager@example.com"
              />

              <View style={styles.presets}>
                <Chip
                  label="Full access"
                  selected={countGranted(draft) === PERMISSION_AREAS.length}
                  onPress={() => setDraft(FULL_PERMISSIONS)}
                />
                <Chip
                  label="Assistant"
                  selected={
                    countGranted(draft) === countGranted(DEFAULT_PERMISSIONS) &&
                    PERMISSION_AREAS.every((a) => draft[a.key] === DEFAULT_PERMISSIONS[a.key])
                  }
                  onPress={() => setDraft(DEFAULT_PERMISSIONS)}
                />
              </View>

              <PermissionSwitches value={draft} onChange={setDraft} disabled={sending} />

              <Button
                label={sending ? 'Inviting…' : 'Send invite'}
                onPress={handleInvite}
                disabled={sending}
                fullWidth
              />
              <Button label="Cancel" variant="ghost" onPress={resetInvite} fullWidth />
            </Animated.View>
          ) : (
            <PressableScale
              onPress={() => setInviting(true)}
              accessibilityRole="button"
              accessibilityLabel="Invite a manager"
              style={[styles.add, { borderColor: c.borderStrong }]}
            >
              <Ionicons name="add" size={17} color={c.accent} />
              <Text style={[styles.addText, { color: c.accentText }]}>Invite a manager</Text>
            </PressableScale>
          )}
        </RevealScrollView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  intro: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  list: {
    gap: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  cardMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  pendingHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  panel: {
    gap: Spacing.base,
  },
  form: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.base,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  switches: {
    gap: Spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    minHeight: 40,
  },
  switchLabel: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    flex: 1,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
  },
  addText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
})
