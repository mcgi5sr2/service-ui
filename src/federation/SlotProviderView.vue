<script setup lang="ts">
// One provider inside a ServiceSlot, behind its own error boundary: a load that
// fails or times out, or a render that throws, is reported to ServiceSlot, which
// removes this provider and nothing else. Internal to ServiceSlot.
import { defineAsyncComponent, onErrorCaptured } from 'vue'
import type { SlotProvider } from './slots'

const LOAD_TIMEOUT_MS = 10_000

const props = defineProps<{ name: string; provider: SlotProvider; data: Record<string, unknown> }>()
const emit = defineEmits<{ failed: [] }>()

const View = defineAsyncComponent({ loader: props.provider.load, timeout: LOAD_TIMEOUT_MS })

onErrorCaptured((err) => {
  // Fail soft for the page, but leave a trace for whoever is debugging it.
  console.warn(`[service-ui] slot "${props.name}": provider "${props.provider.service}" failed`, err)
  emit('failed')
  return false
})
</script>

<template>
  <component :is="View" v-bind="data" />
</template>
