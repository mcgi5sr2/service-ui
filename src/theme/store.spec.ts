import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from './store'

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.className = ''
  delete html.dataset.theme
  delete html.dataset.accent
  setActivePinia(createPinia())
})

describe('theme store', () => {
  it('paints the defaults on init', () => {
    useThemeStore().init()
    expect(html.dataset.theme).toBe('light') // jsdom reports no dark preference
    expect(html.dataset.accent).toBe('violet')
    expect(html.classList.contains('tide')).toBe(false)
  })

  it('re-applies and persists when the user changes theme', async () => {
    const theme = useThemeStore()
    theme.init()
    theme.toggle()
    theme.setAccent('teal')
    theme.toggleSkin()
    await nextTick()
    expect(html.dataset.theme).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)
    expect(html.dataset.accent).toBe('teal')
    expect(html.classList.contains('tide')).toBe(true)
    expect(localStorage.getItem('theme-mode')).toBe('dark')
  })

  it('restores a persisted choice', () => {
    localStorage.setItem('theme-mode', 'dark')
    localStorage.setItem('theme-accent', 'amber')
    useThemeStore().init()
    expect(html.dataset.theme).toBe('dark')
    expect(html.dataset.accent).toBe('amber')
  })
})
