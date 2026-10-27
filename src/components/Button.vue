<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

export type ButtonVariant = 'primary' | 'ghost' | 'subtle'

// Polymorphic: renders a <button> by default, a <RouterLink> when `to` is set, or
// an <a> when `href` is set — so links and form-submit controls share one styling.
// `href` is rendered as given (Vue doesn't filter `javascript:` URLs): never pass
// an unchecked value from user input or an API response.
const props = withDefaults(
  defineProps<{ variant?: ButtonVariant; icon?: string; to?: string; href?: string; type?: 'button' | 'submit' | 'reset' }>(),
  { variant: 'ghost', type: 'button' },
)

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :type="tag === 'button' ? type : undefined"
    class="btn"
    :class="`btn--${variant}`"
  >
    <i v-if="icon" class="pi btn__icon" :class="icon" />
    <slot />
  </component>
</template>

<style scoped>
@layer service-ui {
  .btn {
    /* Own every property a reset would otherwise supply: it looks the same with
       Tailwind's preflight, service-ui/reset.css, or no reset at all. */
    margin: 0;
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid transparent;
    border-radius: var(--radius-ctl);
    padding: 0.5rem 1rem;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    transition: color 150ms, background-color 150ms, border-color 150ms, opacity 150ms;
  }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
  }
  .btn:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .btn__icon {
    font-size: 0.875rem;
  }

  .btn--primary {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .btn--primary:hover {
    opacity: 0.9;
  }

  .btn--ghost {
    border-color: var(--border);
  }
  .btn--ghost:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }

  .btn--subtle {
    background: var(--surface-2);
  }
  .btn--subtle:hover {
    background: var(--surface);
  }
}
</style>
