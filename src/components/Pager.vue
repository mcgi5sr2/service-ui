<script setup lang="ts">
// "Page N · Prev/Next" strip with disabled-edge guards.
defineProps<{ page: number; hasNext: boolean }>()
defineEmits<{ prev: []; next: [] }>()
</script>

<template>
  <div class="pager">
    <button type="button" class="sui-plain-btn pager__btn" :disabled="page <= 1" @click="$emit('prev')">‹ Prev</button>
    <span>Page {{ page }}</span>
    <button type="button" class="sui-plain-btn pager__btn" :disabled="!hasNext" @click="$emit('next')">Next ›</button>
  </div>
</template>

<style scoped>
@layer service-ui {
  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--fm);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--faint);
  }
  .pager__btn {
    border-radius: var(--radius-ctl);
    padding: 0.375rem 0.75rem;
    color: var(--muted);
    transition: color 150ms;
  }
  .pager__btn:enabled:hover {
    color: var(--ink);
  }
  .pager__btn:disabled {
    cursor: default;
    opacity: 0.4;
  }
}
</style>
