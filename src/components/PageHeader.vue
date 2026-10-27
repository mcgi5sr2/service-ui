<script setup lang="ts">
// Shared header for tool pages: title, description, actions. Presentation only —
// pages pass their own controls through the #actions slot; rich/inline
// descriptions use #description, and an optional breadcrumb/number row above the
// title uses #eyebrow.
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="ph">
    <div>
      <slot name="eyebrow" />
      <h1 class="ph__title" :class="{ 'ph__title--after-eyebrow': !!$slots.eyebrow }">{{ title }}</h1>
      <p v-if="description || $slots.description" class="ph__description">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="ph__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
@layer service-ui {
  .ph {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }
  .ph__title {
    margin: 0;
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 600;
    letter-spacing: -0.025em;
    color: var(--ink);
  }
  .ph__title--after-eyebrow {
    margin-top: 0.25rem;
  }
  .ph__description {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--muted);
  }
  .ph__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}
</style>
