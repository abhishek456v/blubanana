import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { needsCode, submitSignInCode, verifiedFactorId } from '@/lib/twoFactor'
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
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({})

  /**
   * Password, or a code emailed over.
   *
   * A creator who signs in twice a month does not remember a password, and
   * the honest alternative to her writing one on a sticky note is not making
   * her invent a better one. `sent` splits the code path in two: ask for the
   * address, then ask for the code.
   */
  const [mode, setMode] = useState<'password' | 'code'>('password')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')

  /**
   * Two-step verification, when the account has it on.
   *
   * A password that is accepted is not the same as a session that is allowed
   * in. Supabase hands back a session at the lower assurance level and expects
   * a code before it counts, so this holds the screen until one arrives.
   */
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  /** Called after any successful credential step. Returns true if a code is owed. */
  async function checkForSecondStep(): Promise<boolean> {
    if (!(await needsCode())) return false
    const factorId = await verifiedFactorId()
    if (!factorId) return false
    setMfaFactorId(factorId)
    return true
  }

  async function handleMfaSubmit() {
    if (!mfaFactorId) return
    if (mfaCode.trim().length < 6) {
      setErrors({ code: 'Enter the 6 digit code from your app' })
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const ok = await submitSignInCode(mfaFactorId, mfaCode)
      if (!ok) {
        // The app rolls its code every thirty seconds, so a rejected one is
        // usually stale rather than mistyped.
        setErrors({ code: 'That code was wrong or has expired. Try the current one.' })
        return
      }
      // The root layout redirects once the session reaches the level the
      // account demands; nothing to navigate to from here.
    } finally {
      setLoading(false)
    }
  }

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
      return
    }
    // A correct password is not the end of it when the account has two-step
    // verification on: the session exists but is not yet allowed anywhere.
    await checkForSecondStep()
    // Otherwise useAuth picks up the session and the root layout redirects
    // into (app)/, with no manual navigation needed here.
  }

  async function handleSendCode() {
    if (!email.trim()) {
      setErrors({ email: 'Enter your email' })
      return
    }
    setErrors({})
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Never sign somebody up by accident. Without this a typo in the
        // address creates a brand new empty workspace and mails a code to it,
        // and the creator is looking at an empty app wondering where her deals
        // went.
        shouldCreateUser: false,
      },
    })
    setLoading(false)

    if (error) {
      toast(error.message, { tone: 'error' })
      return
    }
    setSent(true)
  }

  async function handleVerifyCode() {
    if (!code.trim()) {
      setErrors({ code: 'Enter the code from your email' })
      return
    }
    setErrors({})
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setLoading(false)

    if (error) {
      setErrors({ code: 'That code is wrong or has expired' })
      return
    }
    await checkForSecondStep()
    // Success needs no navigation here either: verifyOtp establishes the
    // session and the root layout does the rest.
  }

  function backToStart() {
    setSent(false)
    setCode('')
    setErrors({})
  }

  return (
    <AuthShell>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.inner, isWide && styles.innerWide]}>
          <Animated.View entering={FadeInDown.duration(Duration.slow)}>
            <Text style={[styles.title, { color: c.textPrimary }]}>
              {mfaFactorId ? 'One more step' : sent ? 'Check your email' : 'Welcome back'}
            </Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {mfaFactorId
                ? 'Open your authenticator app and type the code it is showing.'
                : sent
                  ? `We sent a 6 digit code to ${email.trim()}. It works once and lasts an hour.`
                  : 'Your deals, deadlines and money are where you left them.'}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(1))}
            style={styles.form}
          >
            {mfaFactorId ? null : (
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
            )}

            {mfaFactorId ? (
              <>
                <TextField
                  label="Code"
                  placeholder="000000"
                  value={mfaCode}
                  onChangeText={(value) => {
                    setMfaCode(value.replace(/[^0-9]/g, ''))
                    if (errors.code) setErrors((e) => ({ ...e, code: undefined }))
                  }}
                  error={errors.code}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={handleMfaSubmit}
                />
                <Button
                  label="Sign in"
                  onPress={handleMfaSubmit}
                  loading={loading}
                  fullWidth
                  size="lg"
                  style={styles.submit}
                />
                {/* Deliberately no "skip". A second step somebody can walk past
                    is not a second step. Losing the authenticator is a support
                    conversation, not a button. */}
              </>
            ) : mode === 'password' ? (
              <>
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
              </>
            ) : sent ? (
              <>
                <TextField
                  label="Code"
                  placeholder="000000"
                  value={code}
                  onChangeText={(value) => {
                    // Digits only: a pasted code often brings a space with it.
                    setCode(value.replace(/[^0-9]/g, ''))
                    if (errors.code) setErrors((e) => ({ ...e, code: undefined }))
                  }}
                  error={errors.code}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={handleVerifyCode}
                />

                <Button
                  label="Sign in"
                  onPress={handleVerifyCode}
                  loading={loading}
                  fullWidth
                  size="lg"
                  style={styles.submit}
                />

                <PressableScale onPress={backToStart} haptic="light" style={styles.switchRow}>
                  <Text style={[styles.forgotText, { color: c.textSecondary }]}>
                    Use a different email
                  </Text>
                </PressableScale>
              </>
            ) : (
              <Button
                label="Email me a code"
                onPress={handleSendCode}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.submit}
              />
            )}

            {!sent ? (
              <PressableScale
                onPress={() => {
                  setMode(mode === 'password' ? 'code' : 'password')
                  setErrors({})
                }}
                haptic="light"
                style={styles.switchRow}
              >
                <Text style={[styles.forgotText, { color: c.accentText }]}>
                  {mode === 'password' ? 'Sign in with a code instead' : 'Use my password instead'}
                </Text>
              </PressableScale>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(2))}>
            <Link href="/(auth)/sign-up" asChild>
              <PressableScale style={styles.switchRow} haptic="light">
                <Text style={[styles.switchText, { color: c.textSecondary }]}>
                  New here?{' '}
                  <Text style={{ color: c.accentText, fontFamily: FontFamily.semiBold }}>
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
