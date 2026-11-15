import { NotFound } from '@/components/NotFound'

/**
 * Any address that matches no route.
 *
 * Without this file expo-router falls back to its own "Unmatched Route"
 * screen: a developer page in the framework's styling, with a sitemap link
 * that lists every route in the app.
 *
 * A signed-out visitor never sees this. The root layout sends them to sign-in
 * first, the same as for any address outside the auth group.
 */
export default function NotFoundScreen() {
  return <NotFound />
}
