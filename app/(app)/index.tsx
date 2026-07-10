import { Redirect } from 'expo-router'

// The real dashboard lives at (tabs)/index.tsx.
// This file exists only to handle any navigation that lands at /(app)/.
export default function AppIndex() {
  return <Redirect href={'/(app)/(tabs)/' as never} />
}
