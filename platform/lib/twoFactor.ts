import { supabase } from './supabase'

/**
 * Two-step verification, over Supabase's TOTP factors.
 *
 * TOTP rather than SMS, and not only because SMS in India needs DLT
 * registration and a paid provider. A code from an authenticator app cannot be
 * intercepted by swapping somebody's SIM, which is the attack that actually
 * happens to people worth attacking.
 *
 * The whole point is that the secret lives in exactly two places: the
 * authenticator app and Supabase. Nothing here sends it anywhere else, and the
 * QR is drawn on the device rather than fetched from an image service.
 */

export interface EnrolledFactor {
  id: string
  friendlyName: string | null
  /** 'verified' is the only state that actually protects anything. */
  status: 'verified' | 'unverified'
}

export interface StartedEnrolment {
  factorId: string
  /** The otpauth:// URI to put in a QR code. */
  uri: string
  /** The same secret in text, for anyone typing it in by hand. */
  secret: string
}

/** Factors already on the account. An empty list means 2FA is off. */
export async function listFactors(): Promise<EnrolledFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return (data?.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status as EnrolledFactor['status'],
  }))
}

/**
 * Begins enrolment and returns what the authenticator app needs.
 *
 * Creates an *unverified* factor. It protects nothing until `confirmEnrolment`
 * succeeds, which is deliberate: somebody who scans the code and then loses
 * their phone before confirming has not locked themselves out.
 *
 * Any unverified leftovers are cleared first. Supabase refuses a second factor
 * with the same name, and an abandoned attempt would otherwise block every
 * future one with an error that says nothing useful.
 */
export async function startEnrolment(): Promise<StartedEnrolment> {
  for (const factor of await listFactors()) {
    if (factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {})
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw error
  return {
    factorId: data.id,
    uri: data.totp.uri,
    secret: data.totp.secret,
  }
}

/**
 * Confirms a code from the authenticator, which is what turns 2FA on.
 *
 * Returns false for a wrong code rather than throwing: a mistyped digit is an
 * ordinary thing to do and deserves a message next to the field, not an error
 * toast that implies something broke.
 */
export async function confirmEnrolment(factorId: string, code: string): Promise<boolean> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  })
  return !error
}

/**
 * Turns 2FA off.
 *
 * Supabase requires the session to already be at the higher assurance level to
 * do this, which is the right rule: somebody who picked up an unlocked phone
 * cannot quietly remove the thing standing in their way.
 */
export async function removeFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

/**
 * Whether this session still owes a code.
 *
 * `currentLevel` is what the session has proven so far, `nextLevel` is what the
 * account demands. When they differ, sign-in is not finished however complete
 * it looked.
 */
export async function needsCode(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return false
  return !!data && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel
}

/** The verified factor a sign-in challenge should be issued against. */
export async function verifiedFactorId(): Promise<string | null> {
  const factors = await listFactors().catch(() => [])
  return factors.find((f) => f.status === 'verified')?.id ?? null
}

/** Answers the sign-in challenge. False means the code was wrong. */
export async function submitSignInCode(factorId: string, code: string): Promise<boolean> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  })
  return !error
}
