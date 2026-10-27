<script setup lang="ts">
import { computed } from 'vue'
import type { Tone } from './types'
import { toneColor, toneTint } from './tone'

// Mono, tinted status/label pill. Tone maps to the semantic tokens.
const props = withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'neutral' })

const toneStyle = computed(() => ({ background: toneTint[props.tone], color: toneColor[props.tone] }))
</script>

<template>
  <span class="badge" :style="toneStyle">
    <slot />
  </span>
</template>

<style scoped>
@layer service-ui {
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: var(--radius-ctl);
    padding: 0.125rem 0.5rem;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
}
</style>
