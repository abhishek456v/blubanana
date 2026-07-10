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
  Alert,
  useColorScheme,
} from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'

export default function SignInScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)

    if (error) {
      Alert.alert('Sign in failed', error.message)
    }
    // On success, useAuth detects the new session and the root layout
    // redirects to (app)/ automatically — no manual navigation needed here.
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.wordmark, { color: c.textPrimary }]}>CreatorDesk</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Sign in to your account
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
            placeholder="Password"
            placeholderTextColor={c.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: c.fillPrimary }]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={c.onFillPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: c.onFillPrimary }]}>
                Sign in
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity activeOpacity={0.7} style={styles.switchRow}>
            <Text style={[styles.switchText, { color: c.textSecondary }]}>
              Don't have an account?{' '}
              <Text style={{ color: c.textPrimary, fontFamily: FontFamily.medium }}>
                Sign up
              </Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
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
