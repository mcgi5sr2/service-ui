<script setup lang="ts">
import Button from './Button.vue'

// Hairline error card with an optional Retry action.
withDefaults(defineProps<{ message?: string; retryable?: boolean }>(), {
  message: 'Something went wrong.',
  retryable: true,
})
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="error glass">
    <span class="error__text">
      <i class="pi pi-exclamation-circle" />
      <slot>{{ message }}</slot>
    </span>
    <Button v-if="retryable" icon="pi-refresh" @click="$emit('retry')">Retry</Button>
  </div>
</template>

<style scoped>
@layer service-ui {
  .error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--surface);
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  .error__text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--err);
  }
}
</style>
