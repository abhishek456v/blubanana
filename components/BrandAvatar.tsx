import { View, Text, StyleSheet } from 'react-native'
import { AvatarPalette, Radius, FontFamily } from '@/constants/design'

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// Deterministic so the same brand always gets the same color across
// screens/sessions, without storing a color on the row.
function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % AvatarPalette.length
  return AvatarPalette[index]
}

interface BrandAvatarProps {
  name: string
  size?: number
}

export function BrandAvatar({ name, size = 36 }: BrandAvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: colorForName(name),
        },
      ]}
    >
      <Text
        style={{
          fontFamily: FontFamily.semiBold,
          fontSize: Math.round(size * 0.38),
          color: '#FFFFFF',
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
