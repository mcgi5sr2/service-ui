<script setup lang="ts">
// Shimmer placeholder shown during loads. Collapses under prefers-reduced-motion
// (theme.css).
withDefaults(defineProps<{ height?: string; width?: string; rounded?: string }>(), {
  height: '1rem',
  width: '100%',
  rounded: 'var(--radius-ctl)',
})
</script>

<template>
  <div class="skeleton" :style="{ height, width, borderRadius: rounded }" />
</template>

<style scoped>
@layer service-ui {
  .skeleton {
    position: relative;
    overflow: hidden;
    background: var(--surface-2);
  }
  .skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, var(--border), transparent);
    animation: shimmer 1.4s infinite;
  }
}

/* Local to this component (Vue scopes keyframe names in scoped styles), so it
   works whether or not theme.css has loaded. */
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
</style>
