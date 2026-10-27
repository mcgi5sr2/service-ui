<script setup lang="ts">
import { computed } from 'vue'
import Card from './Card.vue'
import type { Tone } from './types'
import { toneColor } from './tone'

// KPI tile: mono uppercase label; a big mono number optionally coloured by
// `tone`, with a muted inline `unit` suffix (e.g. "/ 16", "ms") and an optional
// `sub` descriptor. The default slot holds a mini-bar / severity chips.
const props = withDefaults(
  defineProps<{ label: string; value: string | number; unit?: string; sub?: string; tone?: Tone }>(),
  { tone: 'neutral' },
)
// Neutral reads as ink, not muted: a number with no state is still the headline.
const valueColor = computed(() => (props.tone === 'neutral' ? 'var(--ink)' : toneColor[props.tone]))
</script>

<template>
  <Card>
    <p class="kpi__label">{{ label }}</p>
    <div class="kpi__row">
      <span class="kpi__value" :style="{ color: valueColor }">{{ value }}</span>
      <span v-if="unit" class="kpi__unit">{{ unit }}</span>
      <span v-if="sub" class="kpi__sub">{{ sub }}</span>
    </div>
    <slot />
  </Card>
</template>

<style scoped>
@layer service-ui {
  .kpi__label {
    margin: 0;
    font-family: var(--fm);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--faint);
  }
  .kpi__row {
    margin-top: 0.75rem;
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
  }
  .kpi__value {
    font-family: var(--fm);
    font-size: 34px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.025em;
  }
  .kpi__unit {
    font-family: var(--fm);
    font-size: 1.125rem;
    line-height: 1.75rem;
    color: var(--faint);
  }
  .kpi__sub {
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--muted);
  }
}
</style>
