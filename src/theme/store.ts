import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { useLocalStorage, usePreferredDark } from '@vueuse/core'

export type ThemeMode = 'system' | 'light' | 'dark'
export type Accent = 'violet' | 'cobalt' | 'teal' | 'amber'
/** Visual skin: the flat default, or the "Tide" glass re-skin. Opt-in, persisted. */
export type Skin = 'default' | 'tide'

export const ACCENTS: Accent[] = ['violet', 'cobalt', 'teal', 'amber']

/**
 * Theme store — drives the [data-theme] + [data-accent] attributes and the .tide
 * class on <html>, persisted to localStorage.
 *
 * One instance per document: inside a shell, the shell's copy is the only one
 * (service-ui is a shared singleton), so a remote reading this store sees the
 * shell's choice. Standalone, each service runs its own — and because
 * localStorage is per origin, the choice is remembered per service.
 */
// Namespaced id: inside a shell this shares one pinia with the shell's own stores.
// The localStorage keys are deliberately the common ones, so the choice carries over.
export const useThemeStore = defineStore('service-ui/theme', () => {
  const preferredDark = usePreferredDark()

  const mode = useLocalStorage<ThemeMode>('theme-mode', 'system')
  const accent = useLocalStorage<Accent>('theme-accent', 'violet')
  const skin = useLocalStorage<Skin>('theme-skin', 'default')

  const dark = computed(() =>
    mode.value === 'system' ? preferredDark.value : mode.value === 'dark',
  )

  function apply() {
    const el = document.documentElement
    // `.dark` is not used by service-ui's tokens; it's kept for consumers whose
    // own styles still key off it (e.g. an older token set toggled by .dark).
    el.classList.toggle('dark', dark.value)
    el.dataset.theme = dark.value ? 'dark' : 'light'
    el.dataset.accent = accent.value
    el.classList.toggle('tide', skin.value === 'tide')
  }

  /** Flip between explicit light/dark (leaves 'system' once the user chooses). */
  function toggle() {
    mode.value = dark.value ? 'light' : 'dark'
  }

  function setMode(m: ThemeMode) {
    mode.value = m
  }

  function setAccent(a: Accent) {
    accent.value = a
  }

  /** Flip between the flat default and the Tide glass skin. */
  function toggleSkin() {
    skin.value = skin.value === 'tide' ? 'default' : 'tide'
  }

  /** Call before mount to paint the correct scheme immediately (no flash). */
  function init() {
    apply()
  }

  // Re-apply on any change, including the OS scheme flipping while in 'system'.
  watch([dark, accent, skin], apply)

  return { dark, mode, accent, accents: ACCENTS, skin, toggle, toggleSkin, setMode, setAccent, init }
})
