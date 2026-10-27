<script setup lang="ts">
/**
 * A named extension point another service fills:
 *
 *   <ServiceSlot name="person.card" :version="1" :props="{ email }">
 *     <p>fallback when nothing fills it</p>
 *   </ServiceSlot>
 *
 * The host owns the slot's name and props, and versions the props. Providers
 * whose props version differs are skipped. Always fails soft: no provider, a
 * provider that is down, slow or throws — the page carries on, showing the
 * default slot once nothing is left to render. Standalone there are never
 * providers, so the fallback is what renders.
 */
import { computed, reactive, watch } from 'vue'
import SlotProviderView from './SlotProviderView.vue'
import { slotProviders, type SlotProvider } from './slots'

const p = withDefaults(
  defineProps<{ name: string; props?: Record<string, unknown>; version?: number }>(),
  { props: () => ({}), version: 1 },
)

const providers = computed(() => slotProviders(p.name).filter((x) => x.props === p.version))
const failed = reactive(new Set<string>())
// One identity per provider build: a redeploy is a new provider with a fresh try
// (and a fresh SlotProviderView, so its new `load` is used); a registry refresh
// that changes nothing doesn't re-load providers that already failed.
const id = (x: SlotProvider) => `${x.service}@${x.build}`
watch(
  () => providers.value.map(id).join('|'),
  () => failed.clear(),
)

const empty = computed(() => providers.value.every((x) => failed.has(id(x))))
</script>

<template>
  <template v-for="provider in providers" :key="id(provider)">
    <SlotProviderView
      v-if="!failed.has(id(provider))"
      :name="name"
      :provider="provider"
      :data="p.props"
      @failed="failed.add(id(provider))"
    />
  </template>
  <slot v-if="empty" />
</template>
