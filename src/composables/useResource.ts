import { shallowRef } from 'vue'
import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

/** Window event that asks every mounted resource to refetch (a "Refresh" control). */
export const REFRESH_EVENT = 'app:refresh'

/**
 * Standard data-fetching wrapper for views: `{ data, error, loading, refetch }`.
 * Re-runs the fetch when a shell or standalone layout's "Refresh" control fires
 * {@link REFRESH_EVENT}, so every screen gets a working refresh + skeleton-on-load
 * for free.
 *
 * Only the latest run counts. Starting a run aborts the previous one (the fetcher
 * receives its AbortSignal — pass it to the API client), and a run that has been
 * superseded never writes its result, so a slow first load can't overwrite a
 * newer refresh. Unmounting aborts whatever is in flight.
 *
 * `data` is a shallowRef, so replace it wholesale — mutating `data.value.field` in
 * place will not trigger re-render. The last value stays visible while refetching.
 */
export function useResource<T>(fetcher: (signal: AbortSignal) => Promise<T>, options?: { immediate?: boolean }) {
  const data = shallowRef<T | undefined>(undefined)
  const error = shallowRef<unknown>(undefined)
  const loading = shallowRef(false)
  let current: AbortController | null = null

  async function refetch(): Promise<void> {
    current?.abort()
    const run = new AbortController()
    current = run
    loading.value = true
    error.value = undefined
    try {
      const result = await fetcher(run.signal)
      if (current === run) data.value = result
    } catch (e) {
      if (current === run) error.value = e
    } finally {
      if (current === run) {
        loading.value = false
        current = null
      }
    }
  }

  useEventListener(window, REFRESH_EVENT, () => void refetch())
  tryOnScopeDispose(() => current?.abort())

  if (options?.immediate ?? true) void refetch()

  return { data, error, loading, refetch }
}
