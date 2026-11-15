import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getProfile, updateProfile } from '@/lib/profile'
import {
  accountNumberError,
  gstinError,
  ifscError,
  panError,
  phoneError,
  tidyId,
  upiError,
} from '@/lib/validate'
import { ContentMaxWidth, FontFamily, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import { Button, Skeleton, TextField, useToast } from '@/components/ui'

export default function EditProfileScreen() {
  const toast = useToast()
  const router = useRouter()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  const [niche, setNiche] = useState('')
  const [upiId, setUpiId] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [address, setAddress] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  // One message per field, cleared as that field is edited, so a creator fixing
  // the GSTIN is not left looking at a red PAN she has not touched yet.
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const clear = (key: string) => setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev))

  useEffect(() => {
    let active = true
    getProfile()
      .then((profile) => {
        if (!active) return
        setName(profile.name)
        setPhone(profile.phone ?? '')
        setFollowerCount(profile.follower_count != null ? String(profile.follower_count) : '')
        setNiche(profile.niche ?? '')
        setUpiId(profile.upi_id ?? '')
        setBankAccount(profile.bank_account_number ?? '')
        setIfscCode(profile.ifsc_code ?? '')
        setGstin(profile.gstin ?? '')
        setPan(profile.pan ?? '')
        setAddress(profile.address ?? '')
      })
      .catch(() => {
        if (active) toast('Could not load your profile', { tone: 'error' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // toast is stable from the provider; re-running this on it would refetch
    // the profile on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    // All of it at once: stopping at the name hid the billing errors below it
    // until the next press, which read as the form having only one fault.
    const missingName = !name.trim()
    setNameError(missingName ? 'Enter your name' : undefined)

    // Everything here is optional, but what is filled in has to be possible.
    // Saved as typed, a bad GSTIN switched "Charge GST" on for every invoice
    // and went out to a brand with the creator's name on it.
    const found = {
      phone: phoneError(phone),
      gstin: gstinError(gstin),
      pan: panError(pan, gstin),
      upi: upiError(upiId),
      account: accountNumberError(bankAccount),
      ifsc: ifscError(ifscCode),
    }
    setErrors(found)
    if (missingName || Object.values(found).some(Boolean)) {
      toast('Check the highlighted details', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        follower_count: followerCount.trim() ? parseInt(followerCount, 10) : null,
        niche: niche.trim() || null,
        upi_id: upiId.trim() || null,
        bank_account_number: bankAccount.replace(/\s+/g, '') || null,
        ifsc_code: tidyId(ifscCode) || null,
        gstin: tidyId(gstin) || null,
        pan: tidyId(pan) || null,
      })
      toast('Profile saved', { tone: 'success' })
      router.back()
    } catch {
      toast('Could not save your profile', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModalSheet title="Your profile">
        <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
          <View style={[styles.content, isWide && styles.contentWide]}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={62} />
            ))}
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  return (
    <ModalSheet title="Your profile">
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, isWide && styles.contentWide]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextField
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={(value) => {
                setName(value)
                if (nameError) setNameError(undefined)
              }}
              error={nameError}
              autoCapitalize="words"
            />

            <TextField
              label="Phone"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={(value) => {
                setPhone(value)
                clear('phone')
              }}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <TextField
              label="Niche"
              placeholder="Beauty, fitness, food, tech…"
              value={niche}
              onChangeText={setNiche}
              hint="Shown on your public profile card"
            />

            <TextField
              label="Followers"
              placeholder="50000"
              value={followerCount}
              onChangeText={(value) => setFollowerCount(value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              hint="Snapshotted on each new deal, so the app can tell you when your reach has outgrown your rate"
            />

            <View style={styles.sectionBreak}>
              <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Billing</Text>
              <Text style={[styles.sectionHint, { color: c.textSecondary }]}>
                Printed on the invoices you send. Never shown on your public profile.
              </Text>
            </View>

            <TextField
              label="Address"
              placeholder="Flat, street, city, State, PIN"
              value={address}
              onChangeText={setAddress}
              multiline
              autoComplete="street-address"
              hint="A tax invoice has to carry the supplier's address"
            />

            <TextField
              label="GSTIN"
              placeholder="22AAAAA0000A1Z5"
              value={gstin}
              onChangeText={(value) => {
                setGstin(value.toUpperCase())
                clear('gstin')
                clear('pan')
              }}
              error={errors.gstin}
              autoCapitalize="characters"
              autoCorrect={false}
              hint="Leave blank if you're not GST registered"
            />

            <TextField
              label="PAN"
              placeholder="ABCDE1234F"
              value={pan}
              onChangeText={(value) => {
                setPan(value.toUpperCase())
                clear('pan')
              }}
              error={errors.pan}
              autoCapitalize="characters"
              autoCorrect={false}
              hint="Printed on your invoices"
            />

            <TextField
              label="UPI ID"
              placeholder="you@upi"
              value={upiId}
              onChangeText={(value) => {
                setUpiId(value)
                clear('upi')
              }}
              error={errors.upi}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextField
              label="Account number"
              placeholder="Bank account number"
              value={bankAccount}
              onChangeText={(value) => {
                setBankAccount(value)
                clear('account')
              }}
              error={errors.account}
              keyboardType="number-pad"
            />

            <TextField
              label="IFSC"
              placeholder="HDFC0001234"
              value={ifscCode}
              onChangeText={(value) => {
                setIfscCode(value.toUpperCase())
                clear('ifsc')
              }}
              error={errors.ifsc}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Button
              label="Save"
              onPress={handleSave}
              loading={saving}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  contentWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  sectionBreak: {
    marginTop: Spacing.sm,
    gap: Spacing.xxs,
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  sectionHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  submit: {
    marginTop: Spacing.sm,
  },
})
