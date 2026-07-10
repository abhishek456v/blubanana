import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import { Colors, Radius, FontFamily } from '@/constants/design'

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface BrandAvatarProps {
  name: string
  size?: number
}

export function BrandAvatar({ name, size = 36 }: BrandAvatarProps) {
  const isDark = useColorScheme() === 'dark'

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: isDark ? '#2A2A2A' : '#EBEBEB',
        },
      ]}
    >
      <Text
        style={{
          fontFamily: FontFamily.semiBold,
          fontSize: Math.round(size * 0.38),
          color: isDark ? Colors.dark.textPrimary : Colors.light.textPrimary,
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
