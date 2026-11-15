import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui'

/**
 * The one "nothing here" screen.
 *
 * Shared by two callers that must be indistinguishable: an address that
 * matches no route (`app/+not-found.tsx`), and the admin area as seen by
 * anybody who is not an admin (`app/admin/_layout.tsx`). If the two differed
 * by so much as a word, the difference would tell a signed-in creator that
 * `/admin` is a real address, which is the one thing that guard exists to
 * keep quiet.
 *
 * The button is the way out. Without one, a mistyped link on a phone left the
 * creator on a dead page with the browser's back button as the only exit, and
 * in the installed app there is no back button to press.
 */
export function NotFound() {
  const router = useRouter()
  const { c } = useTheme()

  return (
    <View style={[styles.centre, { backgroundColor: c.bgPage }]}>
      <Text style={[styles.title, { color: c.textPrimary }]}>Nothing here</Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        This page does not exist. Check the address, or go back to your dashboard.
      </Text>
      <Button
        label="Back to your dashboard"
        onPress={() => router.replace('/(app)/(tabs)/' as never)}
        style={styles.action}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  body: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 22,
  },
  // Button sets itself to the start of its row; here it sits under centred text.
  action: { marginTop: Spacing.lg, alignSelf: 'center' },
})
