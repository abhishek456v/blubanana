import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AuthFormMaxWidth, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { AuthShell } from '@/components/AuthShell'
import { Button, PressableScale, TextField, useToast } from '@/components/ui'

export default function ForgotPasswordScreen() {
  const { c } = useTheme()
  const isWide = useIsWideScreen()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function handleSendReset() {
    if (!email.trim()) {
      setError('Enter the email you signed up with')
      return
    }
    setError(undefined)

    setLoading(true)
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    })
    setLoading(false)

    if (sendError) {
      toast(sendError.message, { tone: 'error' })
      return
    }
    // Supabase never reveals whether the address exists, by design; the same
    // confirmation shows either way.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell>
        <View style={styles.container}>
          <Animated.View
            entering={FadeInDown.duration(Duration.slow)}
            style={[styles.inner, isWide && styles.innerWide, styles.sentBlock]}
          >
            <View style={[styles.iconCircle, { backgroundColor: c.accentLight }]}>
              <Ionicons name="mail-outline" size={26} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.textPrimary }]}>Check your inbox</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              If an account exists for {email.trim()}, a reset link is on its way.
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Button label="Back to sign in" variant="secondary" fullWidth size="lg" />
            </Link>
          </Animated.View>
        </View>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.inner, isWide && styles.innerWide]}>
          <Animated.View entering={FadeInDown.duration(Duration.slow)}>
            <Text style={[styles.title, { color: c.textPrimary }]}>Reset password</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              We'll email you a link to set a new one.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(1))}
            style={styles.form}
          >
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                if (error) setError(undefined)
              }}
              error={error}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={handleSendReset}
            />

            <Button
              label="Send reset link"
              onPress={handleSendReset}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(2))}>
            <Link href="/(auth)/sign-in" asChild>
              <PressableScale style={styles.switchRow} haptic="light">
                <Text style={[styles.switchText, { color: c.accentText }]}>Back to sign in</Text>
              </PressableScale>
            </Link>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  innerWide: {
    maxWidth: AuthFormMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  sentBlock: {
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.display,
    fontFamily: FontFamily.display,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  submit: {
    marginTop: Spacing.xs,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  switchText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
})
