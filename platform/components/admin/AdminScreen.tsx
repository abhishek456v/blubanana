import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { PressableScale, Skeleton } from '@/components/ui'

export interface AdminScreenProps {
  title: string
  /** One line under the title saying what the screen is for. */
  hint?: string
  /** Buttons that sit beside the title. */
  actions?: ReactNode
  loading?: boolean
  children: ReactNode
}

/**
 * The frame every admin screen sits in.
 *
 * There is no sidebar here, deliberately. The creator's app has one because
 * moving between Money and Brands twenty times a day is the job; the admin
 * area is a set of errands, each of which starts from the same screen and ends
 * when the errand is done. A back link is the honest shape for that, and it
 * leaves the whole width for the table, which is what these screens are.
 */
export function AdminScreen({ title, hint, actions, loading, children }: AdminScreenProps) {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <PressableScale
          onPress={() => router.push('/admin' as never)}
          accessibilityRole="button"
          accessibilityLabel="Back to the dashboard"
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={15} color={c.textMuted} />
          <Text style={[styles.backText, { color: c.textMuted }]}>Dashboard</Text>
        </PressableScale>

        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
            {hint ? <Text style={[styles.hint, { color: c.textSecondary }]}>{hint}</Text> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <Skeleton height={64} radius={Radius.lg} />
            <Skeleton height={64} radius={Radius.lg} />
            <Skeleton height={64} radius={Radius.lg} />
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
  contentWide: {
    padding: Spacing.lg,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
  },
  backText: { ...Typography.caption, fontFamily: FontFamily.medium },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headText: { flex: 1, gap: 2 },
  title: { ...Typography.display, fontFamily: FontFamily.display },
  hint: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  loading: { gap: Spacing.sm },
})
