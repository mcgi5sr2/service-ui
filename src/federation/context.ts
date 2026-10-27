import { inject, type InjectionKey } from 'vue'
import type { ServiceUiDefinition } from './types'

export const SERVICE_UI: InjectionKey<ServiceUiDefinition> = Symbol('service-ui')

/** The running service's definition, inside a standalone app (e.g. in a custom layout). */
export function useServiceUi(): ServiceUiDefinition {
  const ui = inject(SERVICE_UI, null)
  if (!ui) throw new Error('service-ui: useServiceUi() needs an app started by createStandaloneApp')
  return ui
}
