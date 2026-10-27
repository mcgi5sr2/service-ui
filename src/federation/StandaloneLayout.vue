<script setup lang="ts">
// The default frame for a service running on its own: brand, tool switcher,
// refresh, theme and sign-in. Deliberately plain — inside the shell, the shell's
// own frame replaces it and none of this renders.
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { login, logout } from '../auth'
import { useSessionStore } from '../auth/session'
import Button from '../components/Button.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { REFRESH_EVENT } from '../composables/useResource'
import { useThemeStore } from '../theme/store'
import { useServiceUi } from './context'

const ui = useServiceUi()
const route = useRoute()
const theme = useThemeStore()
const session = useSessionStore()

// The tool the current page belongs to; the first one on pages outside any tool (404).
const tool = computed(() => ui.tools.find((t) => t.id === route.meta.tool) ?? ui.tools[0])

onMounted(() => void session.load())

function refresh() {
  window.dispatchEvent(new Event(REFRESH_EVENT))
}
</script>

<template>
  <div class="sl">
    <header class="sl__bar">
      <RouterLink v-if="tool" :to="tool.base" class="sl__brand">
        <i class="pi" :class="tool.icon" />
        {{ tool.label }}
      </RouterLink>
      <nav v-if="ui.tools.length > 1" class="sl__nav" aria-label="Tools">
        <RouterLink
          v-for="t in ui.tools"
          :key="t.id"
          :to="t.base"
          class="sl__tool"
          :class="{ 'sl__tool--active': t.id === tool?.id }"
          >{{ t.label }}</RouterLink
        >
      </nav>
      <div class="sl__actions">
        <button type="button" class="sui-plain-btn sl__icon" title="Refresh" aria-label="Refresh" @click="refresh">
          <i class="pi pi-refresh" />
        </button>
        <button
          type="button"
          class="sui-plain-btn sl__icon"
          :title="theme.dark ? 'Light theme' : 'Dark theme'"
          :aria-label="theme.dark ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="theme.toggle()"
        >
          <i class="pi" :class="theme.dark ? 'pi-sun' : 'pi-moon'" />
        </button>
        <template v-if="session.signedIn">
          <UserAvatar :initials="session.initials" :title="session.name ?? undefined" />
          <Button variant="subtle" @click="logout()">Sign out</Button>
        </template>
        <Button v-else variant="primary" @click="login()">Sign in</Button>
      </div>
    </header>

    <main class="sl__main" :class="{ 'sl__main--bleed': route.meta.fullBleed }">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
@layer service-ui {
  .sl {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
  }
  .sl__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .sl__brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
  }
  .sl__brand .pi {
    color: var(--accent);
  }
  .sl__nav {
    display: flex;
    gap: 0.25rem;
  }
  .sl__tool {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-ctl);
    font-size: 0.875rem;
    color: var(--muted);
    text-decoration: none;
  }
  .sl__tool:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .sl__tool--active {
    background: var(--accent-tint);
    color: var(--ink);
  }
  .sl__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }
  .sl__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-ctl);
    color: var(--muted);
  }
  .sl__icon:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .sl__icon:focus-visible,
  .sl__tool:focus-visible,
  .sl__brand:focus-visible {
    outline: 2px solid var(--accent);
  }
  .sl__main {
    flex: 1;
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
    box-sizing: border-box;
  }
  .sl__main--bleed {
    max-width: none;
    padding: 0;
  }
}
</style>
