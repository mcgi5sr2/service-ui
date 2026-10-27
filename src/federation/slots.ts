import { shallowRef, type Component } from 'vue'

/** One service's filling for a slot, as the shell resolves it from the registry. */
export interface SlotProvider {
  service: string
  /** The service's current build, from the registry; a new build gets a fresh try. */
  build: string
  /** The props version the provider renders; must equal the host's. */
  props: number
  load: () => Promise<Component>
}

// Indexed by slot once per registry refresh, so each ServiceSlot is a lookup and
// keeps the same array between refreshes. Reactive, so slots already on screen
// pick up providers once the shell has the registry. Standalone nobody sets it,
// and every slot renders its fallback.
const bySlot = shallowRef(new Map<string, SlotProvider[]>())

/**
 * Tell every `ServiceSlot` which providers exist. The shell calls this after each
 * `/registry` fetch, building each `load` with `loadRemote`:
 *
 *   setSlotProviders(upServices.flatMap((s) => (s.manifest.slots?.provides ?? []).map((p) =>
 *     ({ slot: p.slot, service: s.name, build: s.build, props: p.props, load: () => loadRemote(s, p.expose) }))))
 */
export function setSlotProviders(providers: Array<SlotProvider & { slot: string }>): void {
  const next = new Map<string, SlotProvider[]>()
  for (const { slot, ...provider } of providers) {
    const list = next.get(slot) ?? []
    list.push(provider)
    next.set(slot, list)
  }
  bySlot.value = next
}

const NONE: SlotProvider[] = []

/** Current providers for a slot. Reactive: re-evaluates when the providers are replaced. */
export function slotProviders(slot: string): SlotProvider[] {
  return bySlot.value.get(slot) ?? NONE
}
