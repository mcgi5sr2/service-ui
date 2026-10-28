# service-ui

Shared browser-side building blocks for a small fleet of services, each with its own Vue UI. One UI build runs two
ways:

- **standalone** — on the service's own origin, with a plain frame, and
- **federated** — loaded at runtime into a shell that hosts many services' UIs under one origin and one sign-in.

The kit ships TypeScript and `.vue` source; each consumer's Vite compiles it. Pin it by git tag.

```jsonc
"dependencies": { "service-ui": "github:mcgi5sr2/service-ui#v0.1.0" }
```

Peer dependencies: `vue ^3.5`, `vue-router ^5`, `pinia ^3 || ^4`, and `vite ^8` for the build plugin.

## A service's UI

**`src/ui.ts`** — the one place the UI is described. It drives the standalone router, the remote entry and the emitted
manifest, so routes are written once. Import from `service-ui/define`, which has no Vue in it: the build evaluates
this file on its own to write the manifest.

```ts
import { defineServiceUi } from 'service-ui/define'

export default defineServiceUi({
  service: 'my-service',
  views: {
    './List': () => import('./views/List.vue'),
    './Detail': () => import('./views/Detail.vue'),
  },
  tools: [
    {
      id: 'my-tool',
      label: 'My Tool',
      description: 'What it is for, in a sentence.',
      icon: 'pi-box',
      base: '/my-tool',
      listed: 'signed-in',
      routes: [
        { path: '', title: 'Things', expose: './List', auth: 'required' },
        { path: ':id', title: 'Thing', expose: './Detail', auth: 'required' },
      ],
      launcher: [{ label: 'My Tool', icon: 'pi-box', to: '/my-tool', section: 'analysis', order: 10 }],
    },
  ],
})
```

A broken definition throws at startup, listing every problem.

**`src/main.ts`** — standalone:

```ts
import { createStandaloneApp } from 'service-ui/standalone'
import ui from './ui'

createStandaloneApp(ui).app.mount('#app')
```

**`src/remote.ts`** — what the shell loads:

```ts
import { defineRemote } from 'service-ui'
import ui from './ui'

export default defineRemote(ui)
```

**`vite.config.ts`** and the build:

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { cargoVersion, serviceUi } from 'service-ui/vite'

export default defineConfig({
  plugins: [vue(), serviceUi({ version: cargoVersion('../Cargo.toml') })],
})
```

```jsonc
"build": "vite build && vite build --mode remote"
```

| output | serve at | what |
|--------|----------|------|
| `dist/` | `/` | the standalone app |
| `dist/ui/remoteEntry.js` | `/ui/remoteEntry.js` | the remote entry — serve `no-cache` |
| `dist/ui/assets/*` | `/ui/assets/*` | content-hashed chunks and CSS — serve `immutable` |
| `dist/ui/manifest.json` | `/ui/manifest.json` | the manifest, unauthenticated |

Build the app first: the remote build empties only `dist/ui/`.

## Pages

```ts
import { createClient, useResource } from 'service-ui'

const api = createClient('my-service')
const { data, error, loading } = useResource((signal) => api.get<Thing[]>('/api/things', { signal }))
```

For what the browser fetches itself — a download link, an image — `api.url('/api/things/export.csv')` gives
the same-origin URL with the same checks. Paths are the backend's own routes. The wrapper records where the backend is — the origin root standalone,
`/svc/<name>` in a shell — so a page never hard-codes a prefix. `ApiError.status` 0 (or 502/503/504) means "could not
tell", never "empty": render it with `WarnState` (`isUnknown(err)`).

Auth is the server's: the browser holds no token. `getUser()`, `login()`, `stepUp()` and `logout()` talk to same-origin
`/auth/*`.

## Components and styles

`Badge`, `Button`, `Card`, `DataTable`, `Drawer`, `EmptyState`, `ErrorState`, `KpiTile`, `PageHeader`, `Pager`,
`Segmented`, `Skeleton`, `SkeletonList`, `StatusDot`, `Tabs`, `UserAvatar`, `WarnState`.

No CSS framework. Every kit style is scoped and inside `@layer service-ui`, so any rule an app writes outside a layer
wins. Tokens are plain custom properties (`var(--surface)`, `var(--accent)`, …) switched by the theme store.
`service-ui/reset.css` is an opt-in reset; `service-ui/fonts` vendors the fonts and icons (no CDN).

## Slots

A page can offer a named extension point that another service fills:

```vue
<ServiceSlot name="person.card" :version="1" :props="{ email }">
  <p>Shown when nothing fills it.</p>
</ServiceSlot>
```

Declare it in `slots.hosts` as `{ slot: 'person.card', props: 1 }`; a provider declares
`slots.provides: [{ slot, expose, props }]`. Slots always fail soft: a provider that is missing, down, slow, on another
props version or throws is dropped, and the page carries on.

## Shell side

`loadRemote(service, expose)` imports a service's remote entry (only from same-origin `/svc/<name>/ui/`), initialises
its API base, and loads views. `toolRoutes()` and `requireSignIn()` build the same routes the standalone app uses.
`setSlotProviders()` tells every `ServiceSlot` where providers come from. The shell provides `vue`, `vue-router`,
`pinia` and `service-ui` to remotes through an import map; remotes keep them external.

## Manifest

`schema/manifest.v1.schema.json` (also `service-ui/manifest.schema.json`) is the JSON Schema for `manifest.json`. Its
patterns avoid lookarounds so non-ECMAScript validators can use it. The TS types are exported from `service-ui`.

## Development

```sh
npm install
npm test
npm run type-check
```
