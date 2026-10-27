<script setup lang="ts">
// Surface card container. Set :pad="false" to manage padding yourself.
withDefaults(defineProps<{ pad?: boolean }>(), { pad: true })
</script>

<template>
  <div class="card glass" :class="pad && 'card--pad'">
    <slot />
  </div>
</template>

<style scoped>
@layer service-ui {
  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }
  .card--pad {
    padding: 1.5rem;
  }
}
</style>
