<script setup lang="ts" generic="T extends string | number">
import type { SegmentOption } from './types'

// Underline tab bar, e.g. a tool's sub-navigation.
defineProps<{ options: SegmentOption<T>[]; modelValue: T }>()
defineEmits<{ 'update:modelValue': [T] }>()
</script>

<template>
  <div class="tabs" role="tablist">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="tab"
      :aria-selected="o.value === modelValue"
      class="sui-plain-btn tabs__tab"
      :class="o.value === modelValue && 'tabs__tab--active'"
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
@layer service-ui {
  .tabs {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .tabs__tab {
    position: relative;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    padding: 0.25rem 0 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--muted);
    transition: color 150ms, border-color 150ms;
  }
  .tabs__tab:hover {
    color: var(--ink);
  }
  .tabs__tab--active {
    border-bottom-color: var(--accent);
    color: var(--ink);
  }
}
</style>
