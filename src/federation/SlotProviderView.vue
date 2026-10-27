<script setup lang="ts">
// One provider inside a ServiceSlot, behind its own error boundary: a load that
// fails or times out, or a render that throws, removes this provider and nothing
// else. Internal to ServiceSlot.
import { defineAsyncComponent, onErrorCaptured, ref } from 'vue'
import type { SlotProvider } from './slots'

const LOAD_TIMEOUT_MS = 10_000

const props = defineProps<{ name: string; provider: SlotProvider; data: Record<string, unknown> }>()
const emit = defineEmits<{ failed: [] }>()

const failed = ref(false)
const View = defineAsyncComponent({ loader: props.provider.load, timeout: LOAD_TIMEOUT_MS })

onErrorCaptured((err) => {
  if (!failed.value) {
    failed.value = true
    // Fail soft for the page, but leave a trace for whoever is debugging it.
    console.warn(`[service-ui] slot "${props.name}": provider "${props.provider.service}" failed`, err)
    emit('failed')
  }
  return false
})
</script>

<template>
  <component :is="View" v-if="!failed" v-bind="data" />
</template>
