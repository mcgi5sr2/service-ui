<script setup lang="ts">
// Identity chip: initials when known, a person icon otherwise.
defineProps<{ initials?: string | null }>()
</script>

<template>
  <div class="avatar">
    <span v-if="initials" class="avatar__initials">{{ initials }}</span>
    <i v-else class="pi pi-user avatar__icon" />
  </div>
</template>

<style scoped>
@layer service-ui {
  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-ctl);
    background: var(--accent);
    color: var(--accent-ink);
  }
  .avatar__initials {
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 600;
  }
  .avatar__icon {
    font-size: 0.875rem;
  }
}
</style>
