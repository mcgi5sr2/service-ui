import type { Tone } from './types'

// Single source for the tone → token mappings shared by Badge, StatusDot,
// KpiTile and any other status-coloured component. Values are CSS, usable in
// a :style binding or a CSS v-bind().
export const toneColor: Record<Tone, string> = {
  neutral: 'var(--muted)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  err: 'var(--err)',
  accent: 'var(--accent)',
}

export const toneTint: Record<Tone, string> = {
  neutral: 'var(--surface-2)',
  ok: 'var(--ok-t)',
  warn: 'var(--warn-t)',
  err: 'var(--err-t)',
  accent: 'var(--accent-tint)',
}
