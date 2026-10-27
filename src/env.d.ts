// Ambient types a Vite app gets from vite/client. The kit is compiled by each
// consumer's Vite, so these exist at runtime there; declaring the few we use keeps
// the kit's own type-check free of a Vite dependency.

// Stylesheets are imported for their side effect (Vite injects them).
declare module '*.css'

interface ImportMetaEnv {
  readonly DEV: boolean
  /** Local dev identity; see auth/index.ts. */
  readonly VITE_DEV_USER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
