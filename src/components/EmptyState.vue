<script setup lang="ts">
// Dashed-border empty panel. Use for no-results and zero-data first-run states;
// pass actions via the default slot.
defineProps<{ icon?: string; title: string; message?: string }>()
</script>

<template>
  <div class="empty">
    <i v-if="icon" class="pi empty__icon" :class="icon" />
    <p class="empty__title">{{ title }}</p>
    <p v-if="message" class="empty__message">{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
@layer service-ui {
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-card);
    padding: 3rem 1.5rem;
    text-align: center;
  }
  .empty__icon {
    font-size: 1.5rem;
    color: var(--faint);
  }
  .empty__title,
  .empty__message {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  .empty__title {
    font-weight: 500;
    color: var(--ink);
  }
  .empty__message {
    max-width: 24rem;
    color: var(--muted);
  }
}
</style>
