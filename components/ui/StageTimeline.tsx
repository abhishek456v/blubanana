import { useEffect } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, Ease, staggerDelay } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export type StageState = 'done' | 'current' | 'upcoming' | 'skipped'

export interface TimelineStage {
  key: string
  label: string
  /** Formatted for display; pass through `formatRelativeDay` for deadlines. */
  detail?: string | null
  state: StageState
}

export interface StageTimelineProps {
  stages: TimelineStage[]
  onStagePress?: (key: string) => void
  style?: StyleProp<ViewStyle>
}

const NODE_SIZE = 26

/**
 * Vertical stepper for a deal's workflow (script, shoot, edit, publish, live
 * link), and the visual anchor of the deal screen.
 *
 * The product's first promise is "she never misses a deadline", so the single
 * most important thing this screen can answer is *what is next*. A list of
 * four date fields (what deal detail showed before) makes the reader compute
 * that; a timeline with one highlighted node states it.
 *
 * The current node breathes. It is the only looping animation in the app,
 * reserved for the one element that is genuinely asking for action.
 */
export function StageTimeline({ stages, onStagePress, style }: StageTimelineProps) {
  const { c } = useTheme()

  const toneFor = (state: StageState) => {
    switch (state) {
      case 'done':
        return { node: c.success, ring: c.success, text: c.textSecondary }
      case 'current':
        return { node: c.accent, ring: c.accent, text: c.textPrimary }
      case 'skipped':
        return { node: 'transparent', ring: c.border, text: c.textMuted }
      case 'upcoming':
      default:
        return { node: 'transparent', ring: c.borderStrong, text: c.textSecondary }
    }
  }

  return (
    <View style={style}>
      {stages.map((stage, index) => {
        const tone = toneFor(stage.state)
        const isLast = index === stages.length - 1
        // The connector below a node belongs to the transition *out* of it,
        // so it only turns green once this stage itself is complete.
        const connectorDone = stage.state === 'done'

        const row = (
          <View style={styles.row}>
            <View style={styles.rail}>
              <StageNode state={stage.state} color={tone.node} ring={tone.ring} index={index} />
              {!isLast ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: connectorDone ? c.success : c.border },
                  ]}
                />
              ) : null}
            </View>

            <View style={[styles.content, isLast && styles.contentLast]}>
              <Text
                style={[
                  styles.label,
                  {
                    color: tone.text,
                    fontFamily:
                      stage.state === 'current' ? FontFamily.semiBold : FontFamily.medium,
                    textDecorationLine: stage.state === 'skipped' ? 'line-through' : 'none',
                  },
                ]}
              >
                {stage.label}
              </Text>
              {stage.detail ? (
                <Text
                  style={[
                    styles.detail,
                    { color: stage.state === 'current' ? c.accent : c.textMuted },
                  ]}
                >
                  {stage.detail}
                </Text>
              ) : null}
            </View>
          </View>
        )

        return (
          <Animated.View
            key={stage.key}
            entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(index))}
          >
            {onStagePress ? (
              <PressableScale
                onPress={() => onStagePress(stage.key)}
                scaleTo={0.99}
                accessibilityRole="button"
                accessibilityLabel={`${stage.label}${stage.detail ? `, ${stage.detail}` : ''}`}
              >
                {row}
              </PressableScale>
            ) : (
              row
            )}
          </Animated.View>
        )
      })}
    </View>
  )
}

interface StageNodeProps {
  state: StageState
  color: string
  ring: string
  index: number
}

function StageNode({ state, color, ring, index }: StageNodeProps) {
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (state !== 'current') {
      pulse.value = 1
      return
    }
    pulse.value = withDelay(
      staggerDelay(index) + 200,
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: 900, easing: Ease.inOut }),
          withTiming(1, { duration: 900, easing: Ease.inOut })
        ),
        -1,
        false
      )
    )
  }, [state, index, pulse])

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: state === 'current' ? 0.25 : 0,
  }))

  return (
    <View style={styles.nodeWrapper}>
      <Animated.View
        style={[styles.halo, { backgroundColor: ring }, haloStyle]}
        pointerEvents="none"
      />
      <View style={[styles.node, { backgroundColor: color, borderColor: ring }]}>
        {state === 'done' ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
        {state === 'current' ? <View style={styles.currentDot} /> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: NODE_SIZE,
  },
  nodeWrapper: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: Radius.full,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
  },
  connector: {
    flex: 1,
    width: 2,
    minHeight: 22,
    marginVertical: 3,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.lg,
    gap: 1,
  },
  contentLast: {
    paddingBottom: 0,
  },
  label: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  detail: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
})
