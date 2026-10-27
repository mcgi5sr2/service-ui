<script setup lang="ts">
defineProps<{ email?: string }>()
</script>

<template><p class="card">{{ email }}</p></template>
