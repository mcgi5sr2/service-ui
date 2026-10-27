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
import { slotProviders } from './slots'

const p = withDefaults(
  defineProps<{ name: string; props?: Record<string, unknown>; version?: number }>(),
  { props: () => ({}), version: 1 },
)

const providers = computed(() => slotProviders(p.name).filter((x) => x.props === p.version))
const failed = reactive(new Set<string>())
// A new provider list (the registry refreshed, a service came back) gets a fresh chance.
watch(providers, () => failed.clear())

const empty = computed(() => providers.value.every((x) => failed.has(x.service)))
</script>

<template>
  <template v-for="provider in providers" :key="provider.service">
    <SlotProviderView
      v-if="!failed.has(provider.service)"
      :name="name"
      :provider="provider"
      :data="p.props"
      @failed="failed.add(provider.service)"
    />
  </template>
  <slot v-if="empty" />
</template>
