import type { Plugin } from 'vite'

export interface ServiceUiOptions {
  /** Module default-exporting `defineServiceUi(…)` from 'service-ui/define'. Default 'src/ui.ts'. */
  definition?: string
  /** Module default-exporting `defineRemote(…)`. Default 'src/remote.ts'. */
  remote?: string
  /** `vite build --mode <this>` builds the remote. Default 'remote'. */
  remoteMode?: string
  /** Where the remote and manifest.json go; serve it at /ui/. Default 'dist/ui'. */
  outDir?: string
  /** The service's release version. Default: $SERVICE_VERSION, then package.json's version. */
  version?: string
}

/** Packages the shell provides once for every remote. */
export declare const SHARED: readonly string[]

/** `version` from a Cargo.toml's [package] table. */
export declare function cargoVersion(path: string): string

export declare function serviceUi(options?: ServiceUiOptions): Plugin
