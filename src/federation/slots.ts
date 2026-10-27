import { shallowRef, type Component } from 'vue'

/** One service's filling for a slot, as the shell resolves it from the registry. */
export interface SlotProvider {
  service: string
  /** The props version the provider renders; must equal the host's. */
  props: number
  load: () => Promise<Component>
}

export type SlotResolver = (slot: string) => SlotProvider[]

// Reactive, so slots already on screen pick up providers once the shell has the
// registry. Standalone nobody sets it, and every slot renders its fallback.
const resolver = shallowRef<SlotResolver>(() => [])

/**
 * Tell every `ServiceSlot` where providers come from. The shell calls this after
 * fetching `/registry`, building each `load` with `loadRemote`:
 *
 *   setSlotProviders((slot) => upServices.flatMap((s) =>
 *     (s.manifest.slots?.provides ?? []).filter((p) => p.slot === slot)
 *       .map((p) => ({ service: s.name, props: p.props, load: () => loadRemote(s, p.expose) }))))
 */
export function setSlotProviders(next: SlotResolver): void {
  resolver.value = next
}

/** Current providers for a slot. Reactive: re-evaluates when the resolver changes. */
export function slotProviders(slot: string): SlotProvider[] {
  return resolver.value(slot)
}
