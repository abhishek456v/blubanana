import { supabase } from './supabase'
import { clearWorkspaceCache } from './workspace'

/**
 * Deletes the signed-in account and everything in the workspaces it owns.
 *
 * Real deletion, not deactivation (§8.18). This is a DPDP Act 2023 obligation
 * rather than a nicety: the app holds brand contacts' names and phone numbers,
 * which is third-party personal data.
 *
 * The work happens in the `delete-account` edge function, because removing a
 * row from `auth.users` needs the service role — no arrangement of client code
 * can do it. The function takes no user id: it deletes whoever the JWT says is
 * calling, so there is no parameter to tamper with.
 *
 * Signs out afterwards. The session's tokens are no longer backed by a user, so
 * every subsequent request would fail in a way that reads like a bug rather
 * than like the deletion the creator just asked for.
 */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  })

  if (error) throw error
  if (!data?.deleted) throw new Error('Deletion did not complete')

  clearWorkspaceCache()
  await supabase.auth.signOut()
}
