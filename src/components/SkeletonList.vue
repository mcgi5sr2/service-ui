<script setup lang="ts">
import Skeleton from './Skeleton.vue'

// A vertical stack of shimmer blocks — the common loading placeholder.
withDefaults(defineProps<{ count?: number; height?: string }>(), { count: 5, height: '4.5rem' })
</script>

<template>
  <div class="skeleton-list">
    <Skeleton v-for="i in count" :key="i" :height="height" />
  </div>
</template>

<style scoped>
@layer service-ui {
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
