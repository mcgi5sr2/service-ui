<script lang="ts">
// Open drawers across the whole page, in opening order, shared by every instance
// (and, inside a shell, every UI). The body is scroll-locked while any is open, so
// one drawer closing can't unlock the page under another; only the top one
// answers Escape, so one press closes one drawer.
const openStack: symbol[] = []
let overflowBeforeLock = ''

function push(id: symbol) {
  if (openStack.length === 0) {
    overflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  openStack.push(id)
}

function pop(id: symbol) {
  const i = openStack.indexOf(id)
  if (i !== -1) openStack.splice(i, 1)
  if (openStack.length === 0) document.body.style.overflow = overflowBeforeLock
}

const isTop = (id: symbol) => openStack[openStack.length - 1] === id

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])'
</script>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

/**
 * Right-hand slide-over panel.
 *
 * `width` and `flush` exist so a panel that owns its own layout — a guide with a
 * sidebar beside an independently scrolling article — can use this shell rather
 * than reimplementing the Escape key, the scroll lock, the focus restore and the
 * Tab trap.
 */
const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  /** Panel width. `md` is the detail-panel default; `xl` suits a document. */
  width?: 'md' | 'xl'
  /** Drop the body padding and the scroll container, and let the slot lay itself out. */
  flush?: boolean
}>(), { width: 'md', flush: false })
const emit = defineEmits<{ 'update:open': [boolean] }>()

const headingId = useId()
const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
const self = Symbol('drawer')
let holdsLock = false

function close() {
  emit('update:open', false)
}

// Esc closes the top drawer regardless of where focus sits. Listening only while
// open means a page full of closed drawers costs nothing per keypress.
useEventListener(() => (props.open ? window : null), 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isTop(self)) close()
})

// Lock body scroll, move focus into the panel on open, and restore it on close.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen && !holdsLock) {
      push(self)
      holdsLock = true
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      panel.value?.focus()
    } else if (!isOpen && holdsLock) {
      pop(self)
      holdsLock = false
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

// Never leave the body scroll-locked if we unmount while open (e.g. route change).
onUnmounted(() => {
  if (holdsLock) pop(self)
})

// Trap Tab within the panel so keyboard focus can't wander behind the backdrop.
function onTab(e: KeyboardEvent) {
  if (!panel.value) return
  // Visible ones only: a v-show-hidden control can't take focus, so it can't be the
  // first or last stop.
  const focusables = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  )
  if (focusables.length === 0) {
    e.preventDefault()
    return
  }
  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dw">
      <div v-if="open" class="dw" @click.self="close">
        <aside
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="headingId"
          tabindex="-1"
          class="dw__panel"
          :class="`dw__panel--${width}`"
          @keydown.tab="onTab"
        >
          <header class="dw__header">
            <h2 :id="headingId" class="dw__title"><slot name="title">{{ title }}</slot></h2>
            <button type="button" class="sui-plain-btn dw__close" title="Close" @click="close">
              <i class="pi pi-times" />
            </button>
          </header>
          <div v-if="flush" class="dw__body dw__body--flush"><slot /></div>
          <div v-else class="dw__body dw__body--scroll"><slot /></div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@layer service-ui {
  .dw {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    justify-content: flex-end;
    background: rgb(0 0 0 / 0.4);
    backdrop-filter: blur(2px);
  }
  .dw__panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    max-width: 28rem;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-lg);
    outline: none;
  }
  .dw__panel--xl {
    max-width: 64rem;
  }
  .dw__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem;
  }
  .dw__title {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
    color: var(--ink);
  }
  .dw__close {
    border-radius: var(--radius-ctl);
    padding: 0.375rem;
    color: var(--muted);
    font-size: 0.875rem;
    line-height: 1;
    transition: color 150ms, background-color 150ms;
  }
  .dw__close:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .dw__body {
    flex: 1;
  }
  .dw__body--flush {
    display: flex;
    min-height: 0;
  }
  .dw__body--scroll {
    overflow-y: auto;
    padding: 1.5rem;
  }

  .dw-enter-active,
  .dw-leave-active {
    transition: opacity 0.2s ease;
  }
  .dw-enter-from,
  .dw-leave-to {
    opacity: 0;
  }
  .dw-enter-active .dw__panel,
  .dw-leave-active .dw__panel {
    transition: transform 0.2s ease;
  }
  .dw-enter-from .dw__panel,
  .dw-leave-to .dw__panel {
    transform: translateX(100%);
  }
}
</style>
