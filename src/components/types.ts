// Shared types for the components.

/** Semantic tone shared by Badge, StatusDot, KpiTile and other status-coloured bits. */
export type Tone = 'neutral' | 'ok' | 'warn' | 'err' | 'accent'

/** A column definition for DataTable. */
export interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

/** An option for Segmented / Tabs. */
export interface SegmentOption<T extends string | number = string> {
  label: string
  value: T
}
