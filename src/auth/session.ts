import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getUser, identityChanges } from '.'

/** Up to two initials from a display name or email: "Ada Lovelace" → "AL", "ada@x" → "A". */
export function initialsOf(nameOrEmail: string): string {
  return nameOrEmail
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Reactive view of the signed-in user for layouts: the user menu, the sign-in
 * chip, tile visibility. `load()` reads the auth module's cached identity, so
 * calling it from several places costs one request; it re-runs by itself when
 * the identity is invalidated.
 */
// Ids are namespaced: inside a shell this shares one pinia with the shell's own stores.
export const useSessionStore = defineStore('service-ui/session', () => {
  const name = ref<string | null>(null)
  const email = ref<string | null>(null)
  const signedIn = ref(false)

  // name already falls back to the email in load().
  const initials = computed(() => initialsOf(name.value ?? ''))

  // Last call wins: a slow load that started before an invalidation must not
  // overwrite the newer answer with a dead session's identity.
  let latest = 0
  async function load() {
    const call = ++latest
    const u = await getUser()
    if (call !== latest) return
    signedIn.value = !!u
    name.value = u?.name ?? u?.email ?? null
    email.value = u?.email ?? null
  }

  // A 401 anywhere invalidates the identity; re-read so the UI stops claiming
  // "signed in" for a session that has died.
  watch(identityChanges, () => void load())

  return { name, email, initials, signedIn, load }
})
