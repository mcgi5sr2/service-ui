<script setup lang="ts">
/**
 * "We could not determine this" — the third first-class state, beside ErrorState and
 * EmptyState.
 *
 * Empty means we asked and there is nothing. Error means it broke. This one means we never
 * found out, and it exists because those three are constantly collapsed into each other:
 * a service that is down renders as "you have no data", which is a confident lie told
 * calmly. The rule is that a broken reader must look broken, not approving — and this is
 * that rule as a component rather than as a comment re-argued at each call site.
 *
 * Amber, not red. Not an error: nobody did anything wrong, and often nothing is even
 * broken — the pod may simply be rolling. It is a gap in what we know.
 *
 * The `title` and default slot carry the meaning; the colour is peripheral only, because
 * colour alone excludes anyone who cannot see it.
 */
withDefaults(defineProps<{ title: string; icon?: string; detail?: string | null }>(), {
  icon: 'pi-exclamation-triangle',
  detail: null,
})
</script>

<template>
  <div class="warn">
    <i class="pi warn__icon" :class="icon"></i>
    <div class="warn__body">
      <p class="warn__title">{{ title }}</p>
      <p v-if="$slots.default" class="warn__text"><slot /></p>
      <!-- The server's own words, kept mono and quiet: useful to whoever reports it, noise
           to everyone else. -->
      <p v-if="detail" class="warn__detail">{{ detail }}</p>
    </div>
  </div>
</template>

<style scoped>
@layer service-ui {
  .warn {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    border: 1.5px solid var(--warn);
    border-radius: var(--radius-card);
    padding: 0.75rem 0.875rem;
  }
  .warn__icon {
    padding-top: 0.125rem;
    font-size: 0.875rem;
    color: var(--warn);
  }
  .warn__body {
    min-width: 0;
  }
  .warn__title,
  .warn__text,
  .warn__detail {
    margin: 0;
  }
  .warn__title {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
  }
  .warn__text {
    margin-top: 0.125rem;
    font-size: 13px;
    color: var(--muted);
  }
  .warn__detail {
    margin-top: 0.375rem;
    overflow-wrap: break-word;
    font-family: var(--fm);
    font-size: 11px;
    color: var(--faint);
  }
}
</style>
