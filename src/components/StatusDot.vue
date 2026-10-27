<script setup lang="ts">
import { computed } from 'vue'
import type { Tone } from './types'
import { toneColor } from './tone'

// Small status dot; colour tracks the semantic tokens.
const props = withDefaults(defineProps<{ tone?: Tone; pulse?: boolean }>(), { tone: 'neutral' })

const color = computed(() => toneColor[props.tone])
</script>

<template>
  <span class="dot" :class="pulse && 'dot--pulse'" :style="{ background: color }" />
</template>

<style scoped>
@layer service-ui {
  .dot {
    display: inline-block;
    flex-shrink: 0;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
  }
  .dot--pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}

@keyframes pulse {
  50% { opacity: 0.5; }
}
</style>
