/**
 * Run a service's UI on its own origin — its `src/main.ts` is just
 *
 *   import { createStandaloneApp } from 'service-ui/standalone'
 *   import ui from './ui'
 *   createStandaloneApp(ui).app.mount('#app')
 *
 * A separate entry point because it brings the theme stylesheet and fonts with
 * it: inside a shell those are the shell's, and the remote entry must not carry
 * a second copy.
 */
import '../theme/theme.css'
import '../theme/fonts'
import { createApp, defineComponent, h, type App, type Component } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'
import { setApiBase } from '../api/client'
import EmptyState from '../components/EmptyState.vue'
import { useThemeStore } from '../theme/store'
import { SERVICE_UI } from './context'
import { loadView } from './remote'
import { requireSignIn, toolRoutes } from './routes'
import StandaloneLayout from './StandaloneLayout.vue'
import type { ServiceUiDefinition } from './types'

export interface StandaloneOptions {
  /** Root component; must render a <RouterView>. Default: StandaloneLayout. */
  layout?: Component
  /** Where '/' goes. Default: the first tool's base. */
  home?: string
  /** Rendered for unknown paths. */
  notFound?: Component
}

const NotFound = defineComponent({
  name: 'NotFound',
  setup: () => () =>
    h(EmptyState, { icon: 'pi-compass', title: 'Page not found', message: 'Nothing lives at this address.' }),
})

export function createStandaloneApp(
  def: ServiceUiDefinition,
  options: StandaloneOptions = {},
): { app: App; router: Router; pinia: Pinia } {
  // Standalone, the API is this origin's root.
  setApiBase(def.service, '')

  const home = options.home ?? def.tools[0]?.base
  const routes: RouteRecordRaw[] = [
    ...(home ? [{ path: '/', redirect: home }] : []),
    ...toolRoutes(def.tools, (expose) => () => loadView(def, expose)),
    { path: '/:pathMatch(.*)*', component: options.notFound ?? NotFound, meta: { title: 'Not found' } },
  ]
  const router = createRouter({ history: createWebHistory(), routes })
  router.beforeEach(requireSignIn(router))
  // After the navigation commits, so a redirecting guard can't leave the tab
  // claiming a page the user never reached. Page first: tabs truncate from the right.
  router.afterEach((to) => {
    const label = def.tools.find((t) => t.id === to.meta.tool)?.label
    const parts = [to.meta.title, label].filter((s, i, all): s is string => !!s && all.indexOf(s) === i)
    document.title = parts.join(' · ') || def.service
  })

  const pinia = createPinia()
  const app = createApp(options.layout ?? StandaloneLayout)
  app.use(pinia)
  app.use(router)
  app.provide(SERVICE_UI, def)
  // Paint the stored theme before first render, so there is no flash of the wrong one.
  useThemeStore(pinia).init()

  return { app, router, pinia }
}
