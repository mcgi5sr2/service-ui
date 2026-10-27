<script setup lang="ts" generic="T extends string | number">
import type { SegmentOption } from './types'

// Pill-group control for sort modes / filters / view switches.
defineProps<{ options: SegmentOption<T>[]; modelValue: T }>()
defineEmits<{ 'update:modelValue': [T] }>()
</script>

<template>
  <div class="seg" role="group">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      class="sui-plain-btn seg__opt"
      :class="o.value === modelValue && 'seg__opt--active'"
      :aria-pressed="o.value === modelValue"
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
@layer service-ui {
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-ctl);
    background: var(--surface-2);
    padding: 0.25rem;
  }
  .seg__opt {
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
    font-family: var(--fm);
    font-size: 11px;
    line-height: 1.5;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    transition: color 150ms, background-color 150ms;
  }
  .seg__opt:hover {
    color: var(--ink);
  }
  .seg__opt--active,
  .seg__opt--active:hover {
    background: var(--accent);
    color: var(--accent-ink);
  }
}
</style>
