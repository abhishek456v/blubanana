import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getWorkspaceVersion,
  listWorkspaces,
  subscribeWorkspace,
  switchWorkspace,
  type WorkspaceChoice,
} from '@/lib/workspace'
import { registerPushToken } from '@/lib/push'
import { useAuth } from '@/hooks/useAuth'

/**
 * Which workspace the signed-in user is working in, and the others she could
 * move to.
 *
 * `version` changes on every switch; the signed-in layout keys its screens on
 * it so they read afresh. `choices` is empty until the list has loaded, and
 * has one entry for the great majority of accounts, who never see a switcher.
 */
export function useWorkspace() {
  const version = useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceVersion,
    getWorkspaceVersion
  )
  const { session } = useAuth()
  const [choices, setChoices] = useState<WorkspaceChoice[]>([])

  useEffect(() => {
    // Signed out, the database refuses the question, and there is no workspace
    // to describe anyway.
    if (!session) {
      setChoices([])
      return
    }
    let active = true
    listWorkspaces()
      .then((list) => {
        if (active) setChoices(list)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [version, session])

  const current = choices.find((choice) => choice.isActive) ?? null

  const switchTo = useCallback(async (workspaceId: string) => {
    await switchWorkspace(workspaceId)
    // Reminder pushes go to the workspace a device is registered under, so the
    // phone has to follow her or it keeps buzzing for the one she left.
    registerPushToken().catch(() => {})
  }, [])

  return { version, choices, current, isOwner: current ? current.role === 'owner' : true, switchTo }
}
