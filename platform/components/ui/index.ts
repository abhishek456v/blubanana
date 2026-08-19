// The design-system primitives. Screens should import from '@/components/ui'
// rather than reaching into individual files, so the public surface of the
// library stays visible in one place.

export { PressableScale, type PressableScaleProps } from './PressableScale'
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button'
export { Card, CardSection, type CardProps, type CardSectionProps } from './Card'
export { TextField, type TextFieldProps } from './TextField'
export { DateField, type DateFieldProps } from './DateField'
export { Chip, type ChipProps, type ChipTone } from './Chip'
export { SegmentedControl, type SegmentOption, type SegmentedControlProps } from './SegmentedControl'
export { StarRating, type StarRatingProps } from './StarRating'
export { Sheet, type SheetProps } from './Sheet'
export {
  FeedbackProvider,
  useAlert,
  useConfirm,
  useToast,
  type ConfirmOptions,
  type ToastOptions,
  type ToastTone,
} from './Feedback'
export { Skeleton, SkeletonList, SkeletonRow, type SkeletonProps } from './Skeleton'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { Mark, type MarkProps } from './Mark'
export { ScreenHeader, type HeaderAction, type ScreenHeaderProps } from './ScreenHeader'
export { AnimatedNumber, type AnimatedNumberProps } from './AnimatedNumber'
export { MetricCard, type MetricCardProps, type MetricTone } from './MetricCard'
export { StatTile, type StatTileProps } from './StatTile'
export { HeroCard, type HeroCardProps, type HeroStat } from './HeroCard'
export { ActionGrid, type ActionGridProps, type GridAction } from './ActionGrid'
export { Reveal, RevealScrollView, type RevealProps } from './Reveal'
export { DonutChart, type DonutChartProps, type DonutSegment } from './DonutChart'
export { ThemeToggle, type ThemeToggleProps } from './ThemeToggle'
export { NotificationBell, type NotificationBellProps } from './NotificationBell'
export { SearchButton, type SearchButtonProps } from './SearchButton'
export { HeaderUtilities, type HeaderUtilitiesProps } from './HeaderUtilities'
export { ListRow, type ListRowProps } from './ListRow'
export { DataTable, type DataTableColumn, type DataTableProps } from './DataTable'
export { StageTimeline, type StageState, type StageTimelineProps, type TimelineStage } from './StageTimeline'
export { BarChart, type BarChartDatum, type BarChartProps } from './BarChart'
export { Sparkline, type SparklineProps } from './Sparkline'
export { ProgressRing, type ProgressRingProps } from './ProgressRing'

// The gradient-glass system: the signature card, the dot-matrix figure, and
// the controls and visualisations that only ever appear on top of them.
export { Figure, type FigureProps } from './Figure'
export {
  GradientCard,
  FigureBlock,
  type GradientCardProps,
  type FigureBlockProps,
} from './GradientCard'
export {
  CircleButton,
  CountBadge,
  type CircleButtonProps,
  type CircleButtonTone,
  type CountBadgeProps,
} from './CircleButton'
export { PeriodPill, type PeriodPillProps } from './PeriodPill'
export { OrbitRing, type OrbitItem, type OrbitRingProps } from './OrbitRing'
export { DotGrid, type DotGridProps } from './DotGrid'
export { AuraBackground } from './AuraBackground'
