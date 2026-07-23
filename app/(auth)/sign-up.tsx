import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { showAlert } from '@/lib/alert'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius, Typography, FontFamily, AuthFormMaxWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { AuthShell } from '@/components/AuthShell'

export default function SignUpScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  async function handleSignUp() {
    if (!name.trim() || !email || !password) {
      showAlert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      showAlert('Weak password', 'Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // name is read by the handle_new_user DB trigger to populate profiles.name
        data: { name: name.trim() },
      },
    })
    setLoading(false)

    if (error) {
      showAlert('Sign up failed', error.message)
      return
    }

    // If email confirmation is enabled, data.session will be null.
    // Show a message so the creator knows to check their inbox.
    if (data.session === null) {
      setAwaitingConfirmation(true)
    }
    // If email confirmation is disabled (recommended for dev — see README),
    // useAuth picks up the session and the root layout redirects automatically.
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell>
      <View style={[styles.container, styles.centered, { backgroundColor: c.bgPage }]}>
        <View style={[styles.confirmInner, isWide && styles.innerWide]}>
          <Text style={[styles.wordmark, { color: c.textPrimary, fontFamily: FontFamily.display }]}>
            Check your email
          </Text>
          <Text style={[styles.confirmText, { color: c.textSecondary }]}>
            We sent a confirmation link to{'\n'}
            <Text style={{ color: c.textPrimary, fontFamily: FontFamily.medium }}>{email}</Text>
            {'\n\n'}
            Open it to activate your account, then come back and sign in.
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: c.fillPrimary }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryButtonText, { color: c.onFillPrimary }]}>
                Go to sign in
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, isWide && styles.innerWide]}>
        <Text style={[styles.wordmark, { color: c.textPrimary, fontFamily: FontFamily.display }]}>
          Create account
        </Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Set up your CreatorDesk account
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: c.borderStrong,
                color: c.textPrimary,
                backgroundColor: c.bgSurface,
              },
            ]}
            placeholder="Your name"
            placeholderTextColor={c.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <TextInput
            style={[
              styles.input,
              {
                borderColor: c.borderStrong,
                color: c.textPrimary,
                backgroundColor: c.bgSurface,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextInput
            style={[
              styles.input,
              {
                borderColor: c.borderStrong,
                color: c.textPrimary,
                backgroundColor: c.bgSurface,
              },
            ]}
            placeholder="Password (min 8 characters)"
            placeholderTextColor={c.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: c.onFillPrimary }]}>
                Create account
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity activeOpacity={0.7} style={styles.switchRow}>
            <Text style={[styles.switchText, { color: c.textSecondary }]}>
              Already have an account?{' '}
              <Text style={{ color: c.textPrimary, fontFamily: FontFamily.medium }}>
                Sign in
              </Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
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
  confirmInner: {
    width: '100%',
  },
  wordmark: {
    ...Typography.display,
    fontFamily: FontFamily.semiBold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    marginBottom: Spacing.xl,
  },
  confirmText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  primaryButton: {
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  primaryButtonText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
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
