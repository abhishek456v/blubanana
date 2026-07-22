// react-native-url-polyfill must be the first import — Supabase internals use
// the URL constructor which doesn't exist in the RN JS engine without this.
import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars — check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Lets the client pick up the #access_token=...&type=recovery fragment
    // a password-reset email link lands on (web only — this is a no-op on
    // native, which has no window.location for the client to read; native
    // deep links are handled by hand in app/_layout.tsx instead).
    detectSessionInUrl: true,
  },
})
