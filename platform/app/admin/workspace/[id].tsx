import { useCallback, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { getWorkspaceSnapshot, type WorkspaceSnapshot } from '@/lib/admin'
import { formatCurrency, formatDateLong, formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { Button, Card, EmptyState, ListRow, MetricCard, useToast } from '@/components/ui'

/**
 * What one creator actually has, when they say something has gone missing.
 *
 * Read only, and it says so on the screen. There is no button here that
 * changes anything, because the question that gets asked is always "is it
 * really gone", and answering that should not come with the ability to make it
 * so. Signing in as somebody would be less code and would put an admin's
 * actions into a creator's history looking exactly like theirs.
 */
export default function WorkspaceSnapshotScreen() {
  const { c } = useTheme()
  const toast = useToast()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setSnapshot(await getWorkspaceSnapshot(String(id)))
    } catch {
      toast('Could not open that workspace', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  return (
    <AdminScreen
      title={snapshot?.workspace.name ?? 'Workspace'}
      hint={
        snapshot
          ? `Joined ${formatDateLong(snapshot.workspace.created_at)}. This is a look, not a login: nothing here can be changed.`
          : undefined
      }
      loading={loading}
    >
      {!snapshot ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Nothing to show"
          message="That workspace could not be read."
        />
      ) : (
        <>
          <View style={styles.metrics}>
            <View style={styles.cell}>
              <MetricCard
                label="Received"
                value={snapshot.receivedRupees}
                format={formatCurrency}
                tone="accent"
                index={0}
              />
            </View>
            <View style={styles.cell}>
              <MetricCard
                label="Still owed"
                value={snapshot.pendingRupees}
                format={formatCurrency}
                index={1}
              />
            </View>
            <View style={styles.cell}>
              <MetricCard label="Brands" value={snapshot.brands} index={2} />
            </View>
            <View style={styles.cell}>
              <MetricCard label="Invoices" value={snapshot.invoices} index={3} />
            </View>
          </View>

          {snapshot.owner ? (
            <Card>
              <Text style={[styles.cardTitle, { color: c.textPrimary }]}>
                {snapshot.owner.name ?? 'This account'}
              </Text>
              <Text style={[styles.line, { color: c.textSecondary }]}>
                {[snapshot.owner.email, snapshot.owner.phone].filter(Boolean).join(' · ') ||
                  'No contact details on the account'}
              </Text>
              <View style={styles.contact}>
                {snapshot.owner.phone ? (
                  <Button
                    label="WhatsApp"
                    icon="logo-whatsapp"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      const link = buildWhatsAppLink(
                        snapshot.owner!.phone!,
                        `Hi ${snapshot.owner!.name ?? 'there'}, `
                      )
                      if (link) Linking.openURL(link).catch(() => {})
                    }}
                  />
                ) : null}
                {snapshot.owner.email ? (
                  <Button
                    label="Email"
                    icon="mail-outline"
                    variant="secondary"
                    size="sm"
                    onPress={() => Linking.openURL(`mailto:${snapshot.owner!.email}`).catch(() => {})}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Connected accounts</Text>
            {snapshot.social.length === 0 ? (
              <Text style={[styles.none, { color: c.textSecondary }]}>None connected.</Text>
            ) : (
              snapshot.social.map((account) => (
                <Text
                  key={`${account.platform}-${account.handle}`}
                  style={[styles.line, { color: c.textSecondary }]}
                >
                  {account.platform} · {account.handle} · {account.status}
                </Text>
              ))
            )}
          </Card>

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
            Their last {snapshot.deals.length} deals
          </Text>
          {snapshot.deals.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No deals at all"
              message="This account has never added one, which is worth a message rather than a fix."
            />
          ) : (
            <View style={styles.rows}>
              {snapshot.deals.map((deal, index) => (
                <ListRow
                  key={deal.id}
                  title={deal.deliverable_description || deal.platform}
                  subtitle={`${deal.platform} · ${deal.status}`}
                  meta={formatRelativeDay(deal.created_at)}
                  trailing={
                    <Text style={[styles.amount, { color: c.textPrimary }]}>
                      {formatCurrency(deal.rate)}
                    </Text>
                  }
                  index={index}
                />
              ))}
            </View>
          )}

          {snapshot.reminders.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Recent reminders</Text>
              <View style={styles.rows}>
                {snapshot.reminders.map((reminder, index) => (
                  <ListRow
                    key={reminder.id}
                    title={reminder.type}
                    subtitle={reminder.status}
                    meta={formatRelativeDay(reminder.scheduled_for)}
                    index={index}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.footnote, { color: c.textMuted }]}>
            Opening this page is recorded against your name, with the workspace it was for.
          </Text>
        </>
      )}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'flex-start' },
  cell: { flexGrow: 1, flexBasis: 170 },
  cardTitle: { ...Typography.heading, fontFamily: FontFamily.semiBold, marginBottom: Spacing.xs },
  sectionTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    marginTop: Spacing.sm,
  },
  line: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 20 },
  none: { ...Typography.caption, fontFamily: FontFamily.regular },
  contact: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, flexWrap: 'wrap' },
  rows: { gap: Spacing.sm },
  amount: { ...Typography.bodyStrong, fontFamily: FontFamily.semiBold },
  footnote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
})
