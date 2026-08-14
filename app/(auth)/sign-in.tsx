import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AuthFormMaxWidth, FontFamily, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { AuthShell } from '@/components/AuthShell'
import { Button, PressableScale, TextField, useToast } from '@/components/ui'

export default function SignInScreen() {
  const { c } = useTheme()
  const isWide = useIsWideScreen()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // Inline, per-field, so a mistake is marked where it happened rather than in
  // a modal the user has to dismiss before they can fix anything.
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  async function handleSignIn() {
    const nextErrors: typeof errors = {}
    if (!email.trim()) nextErrors.email = 'Enter your email'
    if (!password) nextErrors.password = 'Enter your password'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (error) {
      toast(error.message, { tone: 'error' })
    }
    // On success, useAuth picks up the new session and the root layout
    // redirects into (app)/ — no manual navigation needed here.
  }

  return (
    <AuthShell>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.bgPage }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.inner, isWide && styles.innerWide]}>
          <Animated.View entering={FadeInDown.duration(Duration.slow)}>
            <Text style={[styles.title, { color: c.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Your deals, deadlines and money are where you left them.
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
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }))
              }}
              error={errors.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <TextField
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }))
              }}
              error={errors.password}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
            />

            <Link href="/(auth)/forgot-password" asChild>
              <PressableScale style={styles.forgotRow} haptic="light">
                <Text style={[styles.forgotText, { color: c.textSecondary }]}>
                  Forgot password?
                </Text>
              </PressableScale>
            </Link>

            <Button
              label="Sign in"
              onPress={handleSignIn}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(2))}>
            <Link href="/(auth)/sign-up" asChild>
              <PressableScale style={styles.switchRow} haptic="light">
                <Text style={[styles.switchText, { color: c.textSecondary }]}>
                  New here?{' '}
                  <Text style={{ color: c.accent, fontFamily: FontFamily.semiBold }}>
                    Create an account
                  </Text>
                </Text>
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
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
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
    fontFamily: FontFamily.regular,
  },
})
