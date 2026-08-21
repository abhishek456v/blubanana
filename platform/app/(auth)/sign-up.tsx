import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { AuthFormMaxWidth, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import { AuthShell } from '@/components/AuthShell'
import { Button, PressableScale, TextField, useToast } from '@/components/ui'

/**
 * Six, because that is what the project itself enforces.
 *
 * It was eight here, which sounds harmless and is not: a creator choosing a
 * six character password met "at least 8 characters" from a form, on a
 * platform that would have accepted it. A client that is stricter than the
 * server is not extra safety, it is a rule nobody agreed to that only the
 * form knows about.
 *
 * Admins are held to ten, enforced where an admin password is actually set:
 * see (auth)/reset-password.tsx.
 */
const MIN_PASSWORD_LENGTH = 6

export default function SignUpScreen() {
  const { c } = useTheme()
  const isWide = useIsWideScreen()
  const toast = useToast()
  // A door that can be held shut from the dashboard, without a release, on the
  // day something is wrong enough that new people should not be walking in.
  const signUpsOpen = useFeatureFlag('sign_ups')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSignUp() {
    const nextErrors: typeof errors = {}
    if (!name.trim()) nextErrors.name = 'What should we call you?'
    if (!email.trim()) nextErrors.email = 'Enter your email'
    if (!password) nextErrors.password = 'Choose a password'
    else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `At least ${MIN_PASSWORD_LENGTH} characters`
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // `name` is read by the handle_new_user DB trigger to populate profiles.name.
      options: { data: { name: name.trim() } },
    })
    setLoading(false)

    if (error) {
      toast(error.message, { tone: 'error' })
      return
    }

    // With email confirmation enabled, there is no session yet, so tell the
    // creator to check their inbox rather than leaving them on a form that
    // looks like it did nothing.
    if (data.session === null) {
      setAwaitingConfirmation(true)
    }
    // With confirmation disabled (recommended for dev; see README), useAuth
    // picks up the session and the root layout redirects automatically.
  }

  if (!signUpsOpen) {
    return (
      <AuthShell>
        <View style={[styles.container, styles.center]}>
          <Animated.View
            entering={FadeInDown.duration(Duration.slow)}
            style={[styles.inner, isWide && styles.innerWide, styles.confirmBlock]}
          >
            <View style={[styles.iconCircle, { backgroundColor: c.accentLight }]}>
              <Ionicons name="time-outline" size={26} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.textPrimary }]}>Not taking new accounts</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              We have paused sign ups for a short while. If you already have an account you can
              still sign in as normal.
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Button label="Sign in" variant="secondary" fullWidth size="lg" />
            </Link>
          </Animated.View>
        </View>
      </AuthShell>
    )
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell>
        <View style={[styles.container, styles.center]}>
          <Animated.View
            entering={FadeInDown.duration(Duration.slow)}
            style={[styles.inner, isWide && styles.innerWide, styles.confirmBlock]}
          >
            <View style={[styles.iconCircle, { backgroundColor: c.accentLight }]}>
              <Ionicons name="mail-outline" size={26} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.textPrimary }]}>Check your inbox</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              We sent a confirmation link to {email.trim()}. Tap it and you're in.
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
            <Text style={[styles.title, { color: c.textPrimary }]}>Run the business side</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Every deal, deadline and payment in one place, so none of them slip.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(1))}
            style={styles.form}
          >
            <TextField
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={(value) => {
                setName(value)
                clearError('name')
              }}
              error={errors.name}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />

            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                clearError('email')
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
                clearError('password')
              }}
              error={errors.password}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleSignUp}
            />

            <Button
              label="Create account"
              onPress={handleSignUp}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(2))}>
            <Link href="/(auth)/sign-in" asChild>
              <PressableScale style={styles.switchRow} haptic="light">
                <Text style={[styles.switchText, { color: c.textSecondary }]}>
                  Already have an account?{' '}
                  <Text style={{ color: c.accentText, fontFamily: FontFamily.semiBold }}>Sign in</Text>
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
  center: {
    justifyContent: 'center',
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
  confirmBlock: {
    flexGrow: 0,
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
    fontFamily: FontFamily.regular,
  },
})
